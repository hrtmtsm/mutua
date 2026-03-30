'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import AppShell from '@/components/AppShell';
import { supabase } from '@/lib/supabase';

export default function SettingsPage() {
  const [showPassword,   setShowPassword]   = useState(false);
  const [newPassword,    setNewPassword]    = useState('');
  const [confirmPass,    setConfirmPass]    = useState('');
  const [passwordError,  setPasswordError]  = useState('');
  const [passwordSaved,  setPasswordSaved]  = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [showFeedback,    setShowFeedback]    = useState(false);
  const [feedbackText,    setFeedbackText]    = useState('');
  const [feedbackSent,    setFeedbackSent]    = useState(false);
  const [sendingFeedback, setSendingFeedback] = useState(false);

  const openPassword = () => {
    setNewPassword(''); setConfirmPass(''); setPasswordError(''); setPasswordSaved(false);
    setShowPassword(true);
  };
  const openFeedback = () => {
    setFeedbackText(''); setFeedbackSent(false);
    setShowFeedback(true);
  };

  const profile = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('mutua_profile') ?? 'null') : null;

  return (
    <>
    <AppShell>
      <main className="flex-1 px-6 py-10 max-w-2xl mx-auto w-full space-y-5">

        <h1 className="font-serif font-semibold text-2xl text-[#171717]">Settings</h1>

        <div className="bg-white rounded-2xl shadow-sm divide-y divide-stone-100">
          <button
            onClick={openPassword}
            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-stone-50 transition-colors rounded-t-2xl"
          >
            <span className="text-sm font-medium text-neutral-700">Change password</span>
            <span className="text-stone-300 text-sm">→</span>
          </button>
          <button
            onClick={openFeedback}
            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-stone-50 transition-colors rounded-b-2xl"
          >
            <span className="text-sm font-medium text-neutral-700">Send feedback</span>
            <span className="text-stone-300 text-sm">→</span>
          </button>
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

    {/* Feedback modal */}
    {showFeedback && (
      <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 px-4 pb-6 sm:pb-0">
        <div className="bg-white rounded-2xl px-5 py-5 w-full max-w-sm relative">
          <button onClick={() => setShowFeedback(false)}
            className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full text-stone-400 hover:text-neutral-700 hover:bg-stone-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
          {feedbackSent ? (
            <div className="py-4 text-center space-y-2">
              <p className="font-semibold text-neutral-900">Thanks for the feedback</p>
              <p className="text-sm text-stone-400">We read everything.</p>
              <button onClick={() => setShowFeedback(false)} className="mt-3 px-5 py-2.5 btn-primary text-white text-sm font-semibold rounded-xl">Done</button>
            </div>
          ) : (
            <>
              <p className="font-semibold text-neutral-900 mb-1">Send feedback</p>
              <p className="text-sm text-stone-400 mb-3">What's working, what's not, or anything else.</p>
              <textarea value={feedbackText} onChange={e => setFeedbackText(e.target.value)}
                placeholder="Your thoughts..." rows={4}
                className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-neutral-800 placeholder:text-stone-300 focus:outline-none focus:border-neutral-400 resize-none" />
              <button
                disabled={!feedbackText.trim() || sendingFeedback}
                onClick={async () => {
                  if (!feedbackText.trim()) return;
                  setSendingFeedback(true);
                  try {
                    await fetch('/api/feedback', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        text: feedbackText.trim(),
                        sessionId: profile?.session_id ?? '',
                        name: profile?.name ?? '',
                      }),
                    });
                  } catch { /* best effort */ }
                  setSendingFeedback(false);
                  setFeedbackSent(true);
                }}
                className="mt-3 w-full py-3 btn-primary text-white font-semibold text-sm rounded-xl disabled:opacity-40"
              >
                {sendingFeedback ? 'Sending…' : 'Send'}
              </button>
            </>
          )}
        </div>
      </div>
    )}
    </>
  );
}
