'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, LogOut } from 'lucide-react';
import AppShell from '@/components/AppShell';
import { supabase } from '@/lib/supabase';

export default function SettingsPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setEmail(data.user.email);
    });
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
    localStorage.clear();
    router.push('/');
  };

  const [showPassword,   setShowPassword]   = useState(false);
  const [newPassword,    setNewPassword]    = useState('');
  const [confirmPass,    setConfirmPass]    = useState('');
  const [passwordError,  setPasswordError]  = useState('');
  const [passwordSaved,  setPasswordSaved]  = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const openPassword = () => {
    setNewPassword(''); setConfirmPass(''); setPasswordError(''); setPasswordSaved(false);
    setShowPassword(true);
  };

  return (
    <>
    <AppShell>
      <main className="flex-1 px-6 py-10 max-w-2xl mx-auto w-full space-y-5">

        <h1 className="font-serif font-semibold text-2xl text-[#171717]">Settings</h1>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-stone-400 px-1 uppercase tracking-wide">Account</p>

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
              <span className="text-sm font-medium text-neutral-700">Change password</span>
              <span className="text-stone-300 text-sm">→</span>
            </button>

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full px-6 py-4 flex items-center gap-3 text-left hover:bg-stone-50 transition-colors rounded-b-2xl disabled:opacity-50"
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
                <input type="password" value={newPassword} onChange={e => { setNewPassword(e.target.value); setPasswordError(''); }} placeholder="New password"
                  className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-neutral-800 placeholder:text-stone-300 focus:outline-none focus:border-neutral-400" />
                <input type="password" value={confirmPass} onChange={e => { setConfirmPass(e.target.value); setPasswordError(''); }} placeholder="Confirm new password"
                  className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-neutral-800 placeholder:text-stone-300 focus:outline-none focus:border-neutral-400" />
              </div>
              {passwordError && <p className="text-xs text-red-500 mt-2">{passwordError}</p>}
              <button
                disabled={!newPassword || !confirmPass || savingPassword}
                onClick={async () => {
                  if (newPassword.length < 6) { setPasswordError('Password must be at least 6 characters.'); return; }
                  if (newPassword !== confirmPass) { setPasswordError("Passwords don't match."); return; }
                  setSavingPassword(true);
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
