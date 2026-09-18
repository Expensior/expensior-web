'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { IconPigMoney, IconCompass } from '@tabler/icons-react';
import FeatureGuide from '@/components/FeatureGuide';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

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
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      <button
        onClick={() => setGuideOpen(true)}
        className="absolute top-5 right-5 flex items-center gap-1.5 text-[var(--muted)] hover:text-[var(--accent)] transition-colors text-sc-13"
        aria-label="Explore what Expensior can do"
      >
        <IconCompass size={18} /> Explore
      </button>

      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3"
            style={{ background: 'color-mix(in srgb, var(--accent), transparent 85%)' }}
          >
            <IconPigMoney size={32} className="text-[var(--accent)]" />
          </div>
          <h1 className="text-2xl font-medium text-[var(--text)]">Expensior!</h1>
          <p className="text-sm text-[var(--muted)] mt-1">Track expenses, savings and indulgence</p>
        </div>

        {sent ? (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 text-center">
            <p className="text-sm text-[var(--text)]">Check your email</p>
            <p className="text-xs text-[var(--muted)] mt-2">
              We sent a sign-in link to <span className="text-[var(--text)]">{email}</span>
            </p>
          </div>
        ) : (
          <>
            <button
              onClick={signInWithGoogle}
              className="w-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] rounded-lg py-2.5 text-sm font-medium mb-4 hover:border-[var(--accent)] transition-colors"
            >
              Continue with Google
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-[var(--border)]" />
              <span className="text-xs text-[var(--muted)]">or</span>
              <div className="flex-1 h-px bg-[var(--border)]" />
            </div>

            <form onSubmit={sendMagicLink}>
              <input
                type="email"
                placeholder="name@email.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)] mb-2"
              />
              {error && <p className="text-xs text-[var(--danger)] mb-2">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[var(--accent)] text-[var(--bg)] rounded-lg py-2.5 text-sm font-medium disabled:opacity-60"
              >
                {loading ? 'Sending link…' : 'Send magic link'}
              </button>
            </form>
          </>
        )}
      </div>

      <FeatureGuide open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  );
}
