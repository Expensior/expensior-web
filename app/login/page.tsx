'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setError('Enter a valid email address');
      return;
    }
    setError('');
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  }

  async function signInWithGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1D2C3E] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-medium text-[#FAF7F2]">Expensior!</h1>
          <p className="text-sm text-[#BDB4C3] mt-1">Track expenses, savings and indulgence</p>
        </div>

        {sent ? (
          <div className="bg-[#355070] border border-[#6D597A] rounded-xl p-5 text-center">
            <p className="text-sm text-[#FAF7F2]">Check your email</p>
            <p className="text-xs text-[#BDB4C3] mt-2">
              We sent a sign-in link to <span className="text-[#FAF7F2]">{email}</span>
            </p>
          </div>
        ) : (
          <>
            <button
              onClick={signInWithGoogle}
              className="w-full bg-[#355070] border border-[#6D597A] text-[#FAF7F2] rounded-lg py-2.5 text-sm font-medium mb-4 hover:border-[#B56576] transition-colors"
            >
              Continue with Google
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-[#6D597A]" />
              <span className="text-xs text-[#BDB4C3]">or</span>
              <div className="flex-1 h-px bg-[#6D597A]" />
            </div>

            <form onSubmit={sendMagicLink}>
              <input
                type="email"
                placeholder="name@email.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                className="w-full bg-[#355070] border border-[#6D597A] rounded-lg px-3 py-2.5 text-sm text-[#FAF7F2] placeholder:text-[#BDB4C3] focus:outline-none focus:border-[#B56576] mb-2"
              />
              {error && <p className="text-xs text-[#E56B6F] mb-2">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#B56576] text-[#1D2C3E] rounded-lg py-2.5 text-sm font-medium disabled:opacity-60"
              >
                {loading ? 'Sending link…' : 'Send magic link'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
