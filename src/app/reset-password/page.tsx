'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [newPassword,    setNewPassword]    = useState('');
  const [confirmPass,    setConfirmPass]    = useState('');
  const [showNew,        setShowNew]        = useState(false);
  const [showConfirm,    setShowConfirm]    = useState(false);
  const [error,          setError]          = useState('');
  const [saving,         setSaving]         = useState(false);
  const [done,           setDone]           = useState(false);
  const [sessionReady,   setSessionReady]   = useState(false);

  // The callback page already called exchangeCodeForSession, so a session exists.
  // We just verify it's there before showing the form.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSessionReady(true);
      } else {
        // No session — the link was stale or already used
        router.replace('/auth/send');
      }
    });
  }, [router]);

  const handleSubmit = async () => {
    if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (newPassword !== confirmPass) { setError("Passwords don't match."); return; }
    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);
    if (updateError) { setError(updateError.message); return; }
    setDone(true);
  };

  if (!sessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-stone-400 text-sm">Verifying link…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        {done ? (
          <>
            <div>
              <p className="font-serif font-black text-2xl text-neutral-900 mb-2">Password updated</p>
              <p className="text-sm text-stone-500 leading-relaxed">
                You're all set. Sign in with your new password anytime.
              </p>
            </div>
            <button
              onClick={() => router.replace('/settings')}
              className="block w-full py-3 text-center btn-primary text-white font-bold text-sm rounded-xl"
            >
              Go to settings →
            </button>
          </>
        ) : (
          <>
            <div>
              <p className="font-serif font-black text-2xl text-neutral-900 mb-2">Set new password</p>
              <p className="text-sm text-stone-500 leading-relaxed">
                Choose a new password for your account.
              </p>
            </div>

            <div className="space-y-3">
              {([
                { value: newPassword,  set: setNewPassword,  show: showNew,     toggle: () => setShowNew(v => !v),     placeholder: 'New password' },
                { value: confirmPass,  set: setConfirmPass,  show: showConfirm, toggle: () => setShowConfirm(v => !v), placeholder: 'Confirm new password' },
              ] as const).map(({ value, set, show, toggle, placeholder }) => (
                <div key={placeholder} className="relative">
                  <input
                    type={show ? 'text' : 'password'}
                    value={value}
                    onChange={e => { set(e.target.value); setError(''); }}
                    placeholder={placeholder}
                    className="w-full border border-stone-200 rounded-xl px-3 pr-10 py-3 text-sm text-neutral-800 placeholder:text-stone-300 focus:outline-none focus:border-neutral-400"
                  />
                  <button type="button" onClick={toggle}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-neutral-600 transition-colors">
                    {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              ))}
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <button
              disabled={!newPassword || !confirmPass || saving}
              onClick={handleSubmit}
              className="w-full py-3 btn-primary text-white font-bold text-sm rounded-xl disabled:opacity-40"
            >
              {saving ? 'Updating…' : 'Update password'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
