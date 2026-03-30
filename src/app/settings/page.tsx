'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, LogOut, Eye, EyeOff } from 'lucide-react';
import AppShell from '@/components/AppShell';
import { supabase } from '@/lib/supabase';

export default function SettingsPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const e = data.session?.user?.email;
      if (e) setEmail(e);
    });
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
    localStorage.clear();
    router.push('/');
  };

  const [showPassword,   setShowPassword]   = useState(false);
  const [currentPass,    setCurrentPass]    = useState('');
  const [newPassword,    setNewPassword]    = useState('');
  const [confirmPass,    setConfirmPass]    = useState('');
  const [passwordError,  setPasswordError]  = useState('');
  const [passwordSaved,  setPasswordSaved]  = useState(false);
  const [savingPassword,  setSavingPassword]  = useState(false);
  const [resetSent,       setResetSent]       = useState(false);
  const [resetEmail,      setResetEmail]      = useState('');
  const [showResetInput,  setShowResetInput]  = useState(false);
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass,     setShowNewPass]     = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const openPassword = () => {
    setCurrentPass(''); setNewPassword(''); setConfirmPass(''); setPasswordError(''); setPasswordSaved(false); setResetSent(false); setShowResetInput(false); setResetEmail('');
    setShowPassword(true);
  };

  return (
    <>
    <AppShell>
      <main className="flex-1 px-6 py-10 max-w-2xl mx-auto w-full space-y-5">

        <h1 className="font-serif font-semibold text-2xl text-[#171717]">Settings</h1>

        <div className="space-y-3">
          <div className="bg-white rounded-2xl shadow-sm divide-y divide-stone-100">
            {/* Email — display only */}
            <div className="px-6 py-4 flex items-center justify-between">
              <span className="text-sm font-medium text-neutral-700">Email</span>
              <span className="text-sm text-stone-400 truncate max-w-[55%] text-right">{email || '—'}</span>
            </div>

            <button
              onClick={openPassword}
              className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-stone-50 transition-colors"
            >
              <span className="text-sm font-medium text-neutral-700">Password</span>
              <span className="text-stone-300 text-sm tracking-widest">••••••••</span>
            </button>
          </div>

          {/* Sign out — visually separated */}
          <div className="bg-white rounded-2xl shadow-sm">
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full px-6 py-4 flex items-center gap-3 text-left hover:bg-stone-50 transition-colors rounded-2xl disabled:opacity-50"
            >
              <LogOut className="w-4 h-4 text-red-400 shrink-0" />
              <span className="text-sm font-medium text-red-500">{loggingOut ? 'Signing out…' : 'Sign out'}</span>
            </button>
          </div>
        </div>

      </main>
    </AppShell>

    {/* Change password modal */}
    {showPassword && (
      <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 px-4 pb-6 sm:pb-0">
        <div className="bg-white rounded-2xl px-5 py-5 w-full max-w-sm relative">
          <button onClick={() => setShowPassword(false)}
            className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full text-stone-400 hover:text-neutral-700 hover:bg-stone-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
          {passwordSaved ? (
            <div className="py-4 text-center space-y-2">
              <p className="font-semibold text-neutral-900">Password updated</p>
              <p className="text-sm text-stone-400">You're all set.</p>
              <button onClick={() => setShowPassword(false)} className="mt-3 px-5 py-2.5 btn-primary text-white text-sm font-semibold rounded-xl">Done</button>
            </div>
          ) : (
            <>
              <p className="font-semibold text-neutral-900 mb-3">Change password</p>
              <div className="space-y-2">
                {([
                  { value: currentPass, set: setCurrentPass, show: showCurrentPass, toggle: () => setShowCurrentPass(v => !v), placeholder: 'Current password' },
                  { value: newPassword, set: setNewPassword, show: showNewPass,     toggle: () => setShowNewPass(v => !v),     placeholder: 'New password' },
                  { value: confirmPass, set: setConfirmPass, show: showConfirmPass, toggle: () => setShowConfirmPass(v => !v), placeholder: 'Confirm new password' },
                ] as const).map(({ value, set, show, toggle, placeholder }, i) => (
                  <div key={placeholder}>
                    <div className="relative">
                      <input
                        type={show ? 'text' : 'password'}
                        value={value}
                        onChange={e => { set(e.target.value); setPasswordError(''); }}
                        placeholder={placeholder}
                        className="w-full border border-stone-200 rounded-xl px-3 pr-10 py-2.5 text-sm text-neutral-800 placeholder:text-stone-300 focus:outline-none focus:border-neutral-400"
                      />
                      <button type="button" onClick={toggle}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-neutral-600 transition-colors">
                        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {i === 0 && (
                      <div className="mt-1">
                        {resetSent ? (
                          <p className="text-xs text-emerald-600 text-right">Reset link sent — check your email</p>
                        ) : showResetInput ? (
                          <div className="flex gap-2 mt-1">
                            <input
                              type="email"
                              value={resetEmail}
                              onChange={e => setResetEmail(e.target.value)}
                              placeholder="Your email"
                              className="flex-1 border border-stone-200 rounded-xl px-3 py-2 text-sm text-neutral-800 placeholder:text-stone-300 focus:outline-none focus:border-neutral-400"
                            />
                            <button type="button"
                              disabled={!resetEmail.trim()}
                              onClick={async () => {
                                const { error: resetErr } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
                                  redirectTo: `${window.location.origin}/auth/callback`,
                                });
                                if (resetErr) { setPasswordError(resetErr.message); return; }
                                setResetSent(true);
                              }}
                              className="px-3 py-2 btn-primary text-white text-xs font-semibold rounded-xl disabled:opacity-40"
                            >
                              Send
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-end">
                            <button type="button"
                              onClick={async () => {
                                let addr = email;
                                if (!addr) {
                                  const { data } = await supabase.auth.getSession();
                                  addr = data.session?.user?.email ?? '';
                                }
                                if (!addr) { setShowResetInput(true); return; }
                                const { error: resetErr } = await supabase.auth.resetPasswordForEmail(addr, {
                                  redirectTo: `${window.location.origin}/auth/callback`,
                                });
                                if (resetErr) { setPasswordError(resetErr.message); return; }
                                setResetSent(true);
                              }}
                              className="text-xs text-[#2B8FFF] hover:underline"
                            >
                              Forgot password?
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {passwordError && <p className="text-xs text-red-500 mt-2">{passwordError}</p>}
              <button
                disabled={!currentPass || !newPassword || !confirmPass || savingPassword}
                onClick={async () => {
                  if (newPassword.length < 6) { setPasswordError('Password must be at least 6 characters.'); return; }
                  if (newPassword !== confirmPass) { setPasswordError("Passwords don't match."); return; }
                  setSavingPassword(true);
                  // Verify current password by re-signing in
                  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: currentPass });
                  if (signInError) { setSavingPassword(false); setPasswordError('Current password is incorrect.'); return; }
                  const { error } = await supabase.auth.updateUser({ password: newPassword });
                  setSavingPassword(false);
                  if (error) { setPasswordError(error.message); return; }
                  setPasswordSaved(true);
                }}
                className="mt-3 w-full py-3 btn-primary text-white font-semibold text-sm rounded-xl disabled:opacity-40"
              >
                {savingPassword ? 'Updating…' : 'Update password'}
              </button>
            </>
          )}
        </div>
      </div>
    )}

    </>
  );
}
