'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { IconShieldLock } from '@tabler/icons-react';

// Rendered instead of the main app when getAuthenticatorAssuranceLevel()
// shows the session is at aal1 but the user has a factor enrolled (meaning
// they need to verify it to reach aal2). Enrolling a factor alone does NOT
// block anything by itself -- this gate is what actually enforces it.
export default function MfaChallenge({ onVerified }: { onVerified: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (code.trim().length !== 6) {
      setError('Enter the 6-digit code from your authenticator app');
      return;
    }
    setError('');
    setVerifying(true);
    const supabase = createClient();

    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError || !factors?.totp?.[0]) {
      setError('Could not find your authentication factor. Try signing in again.');
      setVerifying(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: factors.totp[0].id,
      code: code.trim(),
    });

    setVerifying(false);
    if (verifyError) {
      setError('That code didn\u2019t work -- check the time on your device and try again.');
      setCode('');
    } else {
      onVerified();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: 'color-mix(in srgb, var(--accent), transparent 85%)' }}
        >
          <IconShieldLock size={28} className="text-[var(--accent)]" />
        </div>
        <h1 className="text-lg font-medium text-[var(--text)] mb-1">Two-factor verification</h1>
        <p className="text-sm text-[var(--muted)] mb-6">Enter the 6-digit code from your authenticator app.</p>

        <form onSubmit={verify}>
          <input
            type="text"
            inputMode="numeric"
            autoFocus
            maxLength={6}
            value={code}
            onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setError(''); }}
            placeholder="000000"
            className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-3 text-center text-xl tracking-[0.5em] text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)] mb-3"
          />
          {error && <p className="text-xs mb-3" style={{ color: 'var(--danger)' }}>{error}</p>}
          <button
            type="submit"
            disabled={verifying}
            className="w-full bg-[var(--accent)] text-[var(--bg)] rounded-lg py-2.5 text-sm font-medium disabled:opacity-60"
          >
            {verifying ? 'Verifying…' : 'Verify'}
          </button>
        </form>
      </div>
    </div>
  );
}
