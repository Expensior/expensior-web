import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { parseQuickAdd } from '@/lib/parse';

const SEARCH_QUERY =
  '(receipt OR invoice OR "order confirmed" OR "payment successful" OR "your order" OR subscription) newer_than:30d';

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

    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=15&q=${encodeURIComponent(SEARCH_QUERY)}`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    if (!listRes.ok) {
      const body = await listRes.text();
      console.error('Gmail list failed:', body);
      return NextResponse.json({ error: 'Could not reach Gmail.' }, { status: 502 });
    }
    const listData = await listRes.json();
    const messages: { id: string }[] = listData.messages || [];

    const candidates: { amount: number; description: string; date: string }[] = [];

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

      const date = msgData.internalDate
        ? new Date(parseInt(msgData.internalDate)).toISOString().split('T')[0]
        : undefined;

      const { amount, description } = parseQuickAdd(combined);
      if (amount && amount > 0) {
        candidates.push({ amount, description: (subjectHeader || description).slice(0, 80), date: date || new Date().toISOString().split('T')[0] });
      }
    }

    return NextResponse.json({ candidates });
  } catch (err) {
    console.error('Gmail scan failed:', err);
    return NextResponse.json({ error: 'Something went wrong scanning Gmail.' }, { status: 500 });
  }
}
