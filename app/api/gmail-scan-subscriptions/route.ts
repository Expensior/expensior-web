import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { extractAmountStrict, extractSubscriptionMerchant } from '@/lib/parse';

// Distinct from the transaction-import search — deliberately avoids the bare
// word "subscription" (too promo-prone, matches "get 3 months free" style
// marketing emails). These phrases specifically describe an ALREADY-BILLED
// renewal, not an offer to subscribe.
const SUBSCRIPTION_SEARCH_QUERY =
  '("has been renewed" OR "auto-renewed" OR "subscription renewed" OR "next billing date" OR ' +
  '"your subscription to" OR "renewal payment" OR "recurring payment") ' +
  '-cashback -refund -unsubscribe -newsletter -offer -free newer_than:60d';

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
    return NextResponse.json({ error: 'Gmail scanning is not configured on this deployment' }, { status: 500 });
  }

  try {
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
      return NextResponse.json({ error: 'Gmail access expired — reconnect it in the Gmail tile.' }, { status: 401 });
    }

    const { access_token } = await tokenRes.json();

    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=15&q=${encodeURIComponent(SUBSCRIPTION_SEARCH_QUERY)}`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    if (!listRes.ok) {
      return NextResponse.json({ error: 'Could not reach Gmail.' }, { status: 502 });
    }
    const listData = await listRes.json();
    const messages: { id: string }[] = listData.messages || [];

    // Dedupe by merchant — the same subscription renewing repeatedly across
    // the 60-day window should surface once, not once per email.
    const seen = new Map<string, { merchant: string; amount: number; date: string }>();

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

      const amount = extractAmountStrict(combined);
      if (!amount) continue;

      const merchant = extractSubscriptionMerchant(subjectHeader) || subjectHeader.slice(0, 60);
      const key = merchant.toLowerCase().trim();
      if (key.length < 2) continue;

      const date = msgData.internalDate
        ? new Date(parseInt(msgData.internalDate)).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      if (!seen.has(key)) {
        seen.set(key, { merchant, amount, date });
      }
    }

    return NextResponse.json({ candidates: Array.from(seen.values()) });
  } catch (err) {
    console.error('Subscription scan failed:', err);
    return NextResponse.json({ error: 'Something went wrong scanning for subscriptions.' }, { status: 500 });
  }
}
