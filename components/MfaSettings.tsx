'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { IconShieldCheck, IconShieldLock } from '@tabler/icons-react';

type EnrollState = { factorId: string; qrCode: string; secret: string } | null;

export default function MfaSettings() {
  const [checking, setChecking] = useState(true);
  const [enrolledFactorId, setEnrolledFactorId] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState<EnrollState>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  async function refreshStatus() {
    const supabase = createClient();
    const { data } = await supabase.auth.mfa.listFactors();
    const verified = data?.totp?.find((f) => f.status === 'verified');
    setEnrolledFactorId(verified?.id || null);
    setChecking(false);
  }

  useEffect(() => { refreshStatus(); }, []);

  async function startEnroll() {
    setError('');
    setBusy(true);
    const supabase = createClient();
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Expensior',
    });
    setBusy(false);
    if (enrollError || !data) {
      setError('Could not start setup. Try again.');
      return;
    }
    setEnrolling({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
  }

  async function verifyEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!enrolling || code.trim().length !== 6) {
      setError('Enter the 6-digit code from your authenticator app');
      return;
    }
    setError('');
    setBusy(true);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrolling.factorId,
      code: code.trim(),
    });
    setBusy(false);
    if (verifyError) {
      setError('That code didn\u2019t work -- check the time on your device and try again.');
      setCode('');
      return;
    }
    setEnrolling(null);
    setCode('');
    await refreshStatus();
  }

  async function cancelEnroll() {
    if (enrolling) {
      const supabase = createClient();
      await supabase.auth.mfa.unenroll({ factorId: enrolling.factorId });
    }
    setEnrolling(null);
    setCode('');
    setError('');
  }

  async function removeMfa() {
    if (!enrolledFactorId) return;
    setBusy(true);
    const supabase = createClient();
    await supabase.auth.mfa.unenroll({ factorId: enrolledFactorId });
    setBusy(false);
    setConfirmingRemove(false);
    await refreshStatus();
  }

  if (checking) return null;

  return (
    <div>
      {enrolling ? (
        <div className="bg-[var(--surface)] rounded-xl p-4">
          <p className="text-sc-13 text-[var(--text)] mb-3">Scan this with your authenticator app (Google Authenticator, Authy, or similar):</p>
          <div className="bg-white rounded-lg p-3 mb-3 flex justify-center">
            <img src={enrolling.qrCode} alt="Scan with your authenticator app" width={160} height={160} />
          </div>
          <p className="text-sc-11 text-[var(--muted)] mb-1">Can&apos;t scan it? Enter this code manually:</p>
          <p className="text-sc-12 text-[var(--text)] bg-[var(--bg)]/50 rounded px-2 py-1.5 mb-3 break-all font-mono">{enrolling.secret}</p>
          <form onSubmit={verifyEnroll}>
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              maxLength={6}
              value={code}
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setError(''); }}
              placeholder="Enter the 6-digit code"
              className="w-full bg-[var(--bg)]/50 border border-[var(--border)] rounded-lg px-3 py-2 text-sc-14 text-[var(--text)] placeholder:text-[var(--muted)] mb-2 text-center tracking-widest"
            />
            {error && <p className="text-sc-11 mb-2" style={{ color: 'var(--danger)' }}>{error}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className="flex-1 bg-[var(--accent)] text-[var(--bg)] rounded-lg py-2 text-sc-13 font-medium disabled:opacity-60">
                {busy ? 'Verifying…' : 'Confirm'}
              </button>
              <button type="button" onClick={cancelEnroll} className="text-[var(--muted)] text-sc-13 px-2">Cancel</button>
            </div>
          </form>
        </div>
      ) : enrolledFactorId ? (
        <div className="bg-[var(--surface)] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <IconShieldCheck size={16} style={{ color: 'var(--positive)' }} />
            <p className="text-sc-14 text-[var(--text)] font-medium">Two-factor authentication is on</p>
          </div>
          <p className="text-sc-12 text-[var(--muted)] mb-3">You&apos;ll be asked for a code from your authenticator app each time you sign in.</p>
          {!confirmingRemove ? (
            <button onClick={() => setConfirmingRemove(true)} className="text-sc-13" style={{ color: 'var(--danger)' }}>Turn off</button>
          ) : (
            <div>
              <p className="text-sc-12 mb-2" style={{ color: 'var(--danger)' }}>This removes the extra protection on your account. Are you sure?</p>
              <div className="flex gap-2">
                <button onClick={removeMfa} disabled={busy} className="flex-1 border rounded-lg py-1.5 text-sc-13" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
                  {busy ? 'Removing…' : 'Yes, turn off'}
                </button>
                <button onClick={() => setConfirmingRemove(false)} className="text-[var(--muted)] text-sc-13 px-2">Cancel</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-[var(--surface)] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <IconShieldLock size={16} className="text-[var(--muted)]" />
            <p className="text-sc-14 text-[var(--text)] font-medium">Two-factor authentication is off</p>
          </div>
          <p className="text-sc-12 text-[var(--muted)] mb-3">Add an authenticator app as a second step when signing in, on top of your email or Google sign-in.</p>
          {error && <p className="text-sc-11 mb-2" style={{ color: 'var(--danger)' }}>{error}</p>}
          <button onClick={startEnroll} disabled={busy} className="bg-[var(--accent)] text-[var(--bg)] rounded-lg px-4 py-2 text-sc-13 font-medium disabled:opacity-60">
            {busy ? 'Starting…' : 'Set up 2FA'}
          </button>
        </div>
      )}
    </div>
  );
}
