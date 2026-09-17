import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/?gmail=error`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    console.error('Gmail connect exchange failed:', error);
    return NextResponse.redirect(`${origin}/?gmail=error`);
  }

  const refreshToken = (data.session as any).provider_refresh_token;

  if (!refreshToken) {
    // Google only issues a refresh token on first consent for this scope,
    // unless prompt=consent forced re-consent (which we do request) — if
    // this is still missing, something didn't grant offline access.
    return NextResponse.redirect(`${origin}/?gmail=no_refresh_token`);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from('settings').upsert({ user_id: user.id, gmail_refresh_token: refreshToken });
  }

  return NextResponse.redirect(`${origin}/?gmail=connected`);
}
