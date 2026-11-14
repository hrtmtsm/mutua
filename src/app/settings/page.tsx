'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Pencil, LogOut, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OptionPicker } from '@/components/LanguagePicker';
import { cueTopics, cueLevels, cueVoices, readCueSettings } from '@/lib/cueSettings';
import AppShell from '@/components/AppShell';
import { supabase } from '@/lib/supabase';
import { useLocale } from '@/components/LocaleProvider';

export default function SettingsPage() {
  const { t } = useLocale();
  const router = useRouter();
  const [cue, setCue] = useState(() => readCueSettings(null));
  const [cueDraft, setCueDraft] = useState<typeof cue | null>(null);
  const [cueReady, setCueReady] = useState(false);
  const [cueSaving, setCueSaving] = useState(false);
  const [cueStatus, setCueStatus] = useState('');
  const saveCue = async () => {
    if (!cueDraft || cueSaving) return;
    setCueSaving(true);
    setCueStatus('');
    try {
      const { error } = await supabase.auth.updateUser({ data: { cue_settings: cueDraft } });
      if (error) throw error;
      setCue(cueDraft);
      setCueDraft(null);
    } catch {
      setCueStatus(t('liveExchange.actionFailed'));
    } finally {
      setCueSaving(false);
    }
  };
  const [email, setEmail] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const e = data.session?.user?.email;
      if (e) setEmail(e);
      if (data.session?.user) {
        setCue(readCueSettings(data.session.user.user_metadata.cue_settings));
        setCueReady(true);
      }
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
  const [passwordView,    setPasswordView]    = useState<'change' | 'forgot'>('change');
  const [resetEmail,      setResetEmail]      = useState('');
  const [resetSent,       setResetSent]       = useState(false);
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass,     setShowNewPass]     = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const openPassword = () => {
    setCurrentPass(''); setNewPassword(''); setConfirmPass(''); setPasswordError(''); setPasswordSaved(false); setPasswordView('change'); setResetEmail(''); setResetSent(false);
    setShowPassword(true);
  };

  return (
    <>
    <AppShell>
      <main className="flex-1 px-6 py-10 max-w-2xl mx-auto w-full space-y-5">

        <h1 className="font-serif font-semibold text-2xl text-[#171717]">{t('settings.heading')}</h1>

        <div className="space-y-3">
          <div className="bg-white rounded-2xl shadow-sm divide-y divide-stone-100">
            {/* Email — display only */}
            <div className="px-6 py-4 flex items-center justify-between">
              <span className="text-sm font-medium text-neutral-700">{t('settings.emailLabel')}</span>
              <span className="text-sm text-stone-400 truncate max-w-[55%] text-right">{email || '—'}</span>
            </div>

            <button
              onClick={openPassword}
              className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-stone-50 transition-colors"
            >
              <span className="text-sm font-medium text-neutral-700">{t('settings.passwordLabel')}</span>
              <span className="text-stone-300 text-sm tracking-widest">••••••••</span>
            </button>
          </div>

          <section id="cue" className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{t('aiPractice.titleOffer')}</h2>
              {cueReady && !cueDraft && (
                <Button className="grid size-9 place-items-center rounded-lg hover:bg-current/5" aria-label={t('profile.editTooltip')} onClick={() => setCueDraft(cue)}>
                  <Pencil className="size-4" aria-hidden="true" />
                </Button>
              )}
            </div>
            {[
              { key: 'topic' as const, label: t('aiPractice.topicLabel'), options: cueTopics.map(value => ({ value, label: value })) },
              { key: 'level' as const, label: t('aiPractice.levelLabel'), options: cueLevels.map(value => ({ value, label: value || t('aiPractice.levelUnspecified') })) },
              { key: 'voice' as const, label: 'Cue voice', options: [{ value: 'random', label: 'Random' }, ...cueVoices.map(value => ({ value, label: value === 'marin' ? 'Marin' : 'Cedar' }))] },
            ].map(({ key, label, options }) => cueDraft ? (
              <OptionPicker key={key} label={label} value={cueDraft[key]} onChange={value => setCueDraft(readCueSettings({ ...cueDraft, [key]: value }))} disabled={cueSaving} singleColumn options={options} />
            ) : (
              <dl key={key} className="flex items-center justify-between gap-3 text-sm">
                <dt className="text-[var(--muted)]">{label}</dt>
                <dd className="text-right font-medium">{cueReady ? options.find(option => option.value === cue[key])?.label : '—'}</dd>
              </dl>
            ))}
            {cueDraft && <div className="flex flex-wrap items-center gap-3">
              <Button className="btn-primary rounded-xl px-4 py-2.5 text-sm text-white disabled:opacity-40" onClick={saveCue} disabled={cueSaving}>{t(cueSaving ? 'profile.saving' : 'profile.saveChanges')}</Button>
              <Button className="rounded-xl px-4 py-2.5 text-sm" disabled={cueSaving} onClick={() => { setCueDraft(null); setCueStatus(''); }}>{t('profile.cancel')}</Button>
            </div>}
            {cueStatus && <p role="alert" className="text-sm">{cueStatus}</p>}
          </section>

          {/* Sign out — visually separated */}
          <div className="bg-white rounded-2xl shadow-sm">
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full px-6 py-4 flex items-center gap-3 text-left hover:bg-stone-50 transition-colors rounded-2xl disabled:opacity-50"
            >
              <LogOut className="w-4 h-4 text-red-400 shrink-0" />
              <span className="text-sm font-medium text-red-500">{loggingOut ? t('settings.signingOut') : t('settings.signOut')}</span>
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
              <p className="font-semibold text-neutral-900">{t('settings.passwordUpdatedTitle')}</p>
              <p className="text-sm text-stone-400">{t('settings.allSet')}</p>
              <button onClick={() => setShowPassword(false)} className="mt-3 px-5 py-2.5 btn-primary text-white text-sm font-semibold rounded-xl">{t('settings.done')}</button>
            </div>

          ) : passwordView === 'forgot' ? (
            <>
              <button onClick={() => setPasswordView('change')} className="text-xs text-stone-400 hover:text-neutral-700 mb-3 flex items-center gap-1">{t('settings.back')}</button>
              <p className="font-semibold text-neutral-900 mb-1">{t('settings.resetPasswordTitle')}</p>
              <p className="text-sm text-stone-400 mb-3">{t('settings.resetPasswordBody')}</p>
              {resetSent ? (
                <p className="text-sm text-emerald-600 py-2">{t('settings.resetLinkSent')}</p>
              ) : (
                <>
                  <input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                    placeholder={t('settings.emailPlaceholder')}
                    className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-neutral-800 placeholder:text-stone-300 focus:outline-none focus:border-neutral-400" />
                  {passwordError && <p className="text-xs text-red-500 mt-2">{passwordError}</p>}
                  <button
                    disabled={!resetEmail.trim()}
                    onClick={async () => {
                      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
                        redirectTo: `${window.location.origin}/auth/callback`,
                      });
                      if (resetErr) { setPasswordError(resetErr.message); return; }
                      setResetSent(true);
                    }}
                    className="mt-3 w-full py-3 btn-primary text-white font-semibold text-sm rounded-xl disabled:opacity-40"
                  >
                    {t('settings.sendResetLink')}
                  </button>
                </>
              )}
            </>

          ) : (
            <>
              <p className="font-semibold text-neutral-900 mb-3">{t('settings.changePasswordTitle')}</p>
              <div className="space-y-2">
                {([
                  { value: currentPass, set: setCurrentPass, show: showCurrentPass, toggle: () => setShowCurrentPass(v => !v), placeholder: t('settings.currentPasswordPlaceholder') },
                  { value: newPassword, set: setNewPassword, show: showNewPass,     toggle: () => setShowNewPass(v => !v),     placeholder: t('settings.newPasswordPlaceholder') },
                  { value: confirmPass, set: setConfirmPass, show: showConfirmPass, toggle: () => setShowConfirmPass(v => !v), placeholder: t('settings.confirmPasswordPlaceholder') },
                ] as const).map(({ value, set, show, toggle, placeholder }) => (
                  <div key={placeholder} className="relative">
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
                ))}
              </div>
              {passwordError && <p className="text-xs text-red-500 mt-2">{passwordError}</p>}
              <button
                disabled={!currentPass || !newPassword || !confirmPass || savingPassword}
                onClick={async () => {
                  if (newPassword.length < 6) { setPasswordError(t('settings.passwordTooShort')); return; }
                  if (newPassword !== confirmPass) { setPasswordError(t('settings.passwordsDontMatch')); return; }
                  setSavingPassword(true);
                  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: currentPass });
                  if (signInError) { setSavingPassword(false); setPasswordError(t('settings.currentPasswordIncorrect')); return; }
                  const { error } = await supabase.auth.updateUser({ password: newPassword });
                  setSavingPassword(false);
                  if (error) { setPasswordError(error.message); return; }
                  setPasswordSaved(true);
                }}
                className="mt-3 w-full py-3 btn-primary text-white font-semibold text-sm rounded-xl disabled:opacity-40"
              >
                {savingPassword ? t('settings.updating') : t('settings.updatePassword')}
              </button>
              <div className="flex justify-center mt-3">
                <button type="button" onClick={() => { setPasswordView('forgot'); setResetEmail(email); setPasswordError(''); }}
                  className="text-xs text-stone-400 hover:text-neutral-700 hover:underline">
                  {t('settings.forgotPassword')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    )}

    </>
  );
}
