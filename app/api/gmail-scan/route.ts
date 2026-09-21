import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { extractAmountStrict, extractMerchantDescription } from '@/lib/parse';

const SEARCH_QUERY =
  '(receipt OR invoice OR "order confirmed" OR "payment successful" OR "spent on your" OR "debited") ' +
  '-cashback -refund -unsubscribe -newsletter -"opt-out" -nominee -offer -free newer_than:30d';

// Subjects/snippets containing these almost never represent an actual spend —
// promotions, credits, and account notices that happen to contain a number.
const NOISE_KEYWORDS = [
  'cashback', 'refund', 'reward', 'unsubscribe', 'newsletter', 'delivered',
  'opt-out', 'nominee', 'folio', 'free', 'discount', 'offer', 'sale',
  'credited', 'winner', 'congratulations',
];

function looksLikeNoise(text: string): boolean {
  const lower = text.toLowerCase();
  return NOISE_KEYWORDS.some((kw) => lower.includes(kw));
}

function normalizeMerchant(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Bidirectional substring check, not exact match -- merchant names for the
// same real-world transaction often differ in length across sources
// ("HungerBox" from one email vs "HungerBox - Office Cafeteria" from
// another, or a manually-typed shorter version). An exact-match key would
// wrongly treat these as different merchants and fail to catch the repeat.
function isSameMerchant(a: string, b: string): boolean {
  const na = normalizeMerchant(a);
  const nb = normalizeMerchant(b);
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data: settings } = await supabase
    .from('settings')
    .select('gmail_refresh_token')
    .eq('user_id', user.id)
    .maybeSingle();

  const refreshToken = settings?.gmail_refresh_token;
  if (!refreshToken) {
    return NextResponse.json({ error: 'Gmail is not connected' }, { status: 400 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set on the server');
    return NextResponse.json({ error: 'Gmail scanning is not configured on this deployment' }, { status: 500 });
  }

  try {
    // Exchange the stored refresh token for a fresh short-lived access token.
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      console.error('Google token refresh failed:', body);
      return NextResponse.json({ error: 'Gmail access expired — reconnect it in the Gmail tile.' }, { status: 401 });
    }

    const { access_token } = await tokenRes.json();

    // Fetched pool increased from 15 to 40. Gmail's search ranking for a
    // multi-OR-clause query blends relevance with recency, not pure
    // chronological order -- a genuinely recent email with a weaker keyword
    // match can rank below an older, stronger one. A small maxResults cap
    // makes it easy for that ranking quirk to push recent emails out
    // entirely before they're ever fetched. A bigger pool, explicitly
    // re-sorted by actual date below, is the real fix -- not just a bigger
    // number for its own sake.
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=40&q=${encodeURIComponent(SEARCH_QUERY)}`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    if (!listRes.ok) {
      const body = await listRes.text();
      console.error('Gmail list failed:', body);
      return NextResponse.json({ error: 'Could not reach Gmail.' }, { status: 502 });
    }
    const listData = await listRes.json();
    const messages: { id: string }[] = listData.messages || [];

    const rawCandidates: { amount: number; description: string; date: string; internalDate: number }[] = [];

    for (const msg of messages) {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject`,
        { headers: { Authorization: `Bearer ${access_token}` } }
      );
      if (!msgRes.ok) continue;
      const msgData = await msgRes.json();

      const subjectHeader = msgData.payload?.headers?.find((h: any) => h.name === 'Subject')?.value || '';
      const snippet = msgData.snippet || '';
      const combined = `${subjectHeader} ${snippet}`;

      if (looksLikeNoise(combined)) continue;

      const internalDate = msgData.internalDate ? parseInt(msgData.internalDate) : 0;
      const date = internalDate
        ? new Date(internalDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      const amount = extractAmountStrict(combined);
      if (amount) {
        const cleaned = extractMerchantDescription(subjectHeader) || subjectHeader.slice(0, 80);
        rawCandidates.push({ amount, description: cleaned.slice(0, 80), date, internalDate });
      }
    }

    // Explicit sort by actual date, most recent first -- don't trust
    // whatever order Gmail's search API happened to return.
    rawCandidates.sort((a, b) => b.internalDate - a.internalDate);

    // Dedup against transactions already added, so the same email doesn't
    // resurface as "new" on every scan within the 30-day rolling window.
    // Matches on amount + date + a normalized merchant-name overlap --
    // amount+date alone could occasionally coincide for two genuinely
    // different transactions, so the merchant check guards against
    // wrongly suppressing a legitimate second transaction.
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - 31);
    const { data: existing } = await supabase
      .from('transactions')
      .select('amount, description, date')
      .eq('user_id', user.id)
      .gte('date', windowStart.toISOString().split('T')[0]);

    const existingKeys = new Map<string, { description: string }[]>();
    (existing || []).forEach((t) => {
      const key = `${t.amount}|${t.date}`;
      if (!existingKeys.has(key)) existingKeys.set(key, []);
      existingKeys.get(key)!.push({ description: t.description });
    });

    const candidates = rawCandidates
      .filter((c) => {
        const sameAmountAndDate = existingKeys.get(`${c.amount}|${c.date}`) || [];
        return !sameAmountAndDate.some((e) => isSameMerchant(e.description, c.description));
      })
      .map(({ amount, description, date }) => ({ amount, description, date }));

    return NextResponse.json({ candidates });
  } catch (err) {
    console.error('Gmail scan failed:', err);
    return NextResponse.json({ error: 'Something went wrong scanning Gmail.' }, { status: 500 });
  }
}
