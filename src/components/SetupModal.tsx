'use client';

import { SignupPrivacyNotice } from '@/components/PrivacyNotice';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { type Language } from '@/lib/types';
import LanguagePicker from './LanguagePicker';
import { useLocale } from './LocaleProvider';
import './liveExchange.css';

interface SetupModalProps {
  open:       boolean;
  onClose:    () => void;
  /** Called once auth + native/learning language are both confirmed saved.
   *  Never triggers mic access or matching — the caller decides what to do next.
   *  `isSignup` tells the caller whether this was a brand-new account (which
   *  arrived with a clear "start practicing now" intent) or an existing
   *  account signing back in (which should just land on the home screen,
   *  not be dropped straight into a search). */
  onComplete: (result: { isSignup: boolean }) => void;
  /** Carried over from wherever the caller already picked a language pair
   *  (e.g. the landing page's own pickers) — just pre-fills the fields below,
   *  the person can still change them before submitting. */
  initialNative?:   Language;
  initialLearning?: Language;
  /** Which tab to open on — e.g. a dedicated "Log in" entry point opens
   *  straight to the login tab instead of signup. Defaults to 'signup'. */
  initialTab?: Tab;
}

type Tab   = 'signup' | 'login';
type Stage = 'form' | 'confirm-email' | 'login-needs-language' | 'saving';

async function lookupProfileByEmail(email: string) {
  const { data } = await supabase
    .from('profiles')
    .select('session_id, native_language, learning_language, email')
    .eq('email', email.trim().toLowerCase())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function resolveSessionId(email: string): Promise<string> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/resolve-session', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
      body:    JSON.stringify({ email }),
    });
    const data = await res.json();
    return data.sessionId ?? crypto.randomUUID();
  } catch {
    return crypto.randomUUID();
  }
}

async function persistProfile(opts: {
  sessionId: string; email: string; nativeLanguage: string; learningLanguage: string;
}) {
  // No name is written here, on purpose — a display name isn't collected by
  // this minimal setup and must never be guessed from the email address.
  // The person sets a real name later, in /profile, whenever they choose to.
  const profile: Record<string, string> = {
    session_id:         opts.sessionId,
    email:               opts.email,
    native_language:     opts.nativeLanguage,
    learning_language:   opts.learningLanguage,
  };

  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch('/api/save-profile', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
    body:    JSON.stringify(profile),
  });
  if (!res.ok) throw new Error(await res.text());
  localStorage.setItem('mutua_session_id', opts.sessionId);
  localStorage.setItem('mutua_profile', JSON.stringify(profile));
}

export default function SetupModal({ open, onClose, onComplete, initialNative, initialLearning, initialTab }: SetupModalProps) {
  const { t } = useLocale();
  const [tab,      setTab]      = useState<Tab>(initialTab ?? 'signup');
  const [stage,    setStage]    = useState<Stage>('form');
  const [native,   setNative]   = useState<Language | ''>(initialNative ?? '');
  const [learning, setLearning] = useState<Language | ''>(initialLearning ?? '');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');

  // state carried from a successful login that still needs a language pair
  const [pendingSessionId, setPendingSessionId] = useState('');
  const [pendingEmail,     setPendingEmail]     = useState('');

  // Each fresh open starts clean — never resume a stuck "saving"/error state
  // from a previous attempt (signup, login, or a completed flow). The
  // language pair is the exception: keep whatever's already chosen, and
  // adopt a caller-provided pair if the fields are still empty (it may have
  // arrived after this modal first mounted).
  useEffect(() => {
    if (open) {
      setStage('form');
      setError('');
      setPassword('');
      setTab(initialTab ?? 'signup');
      setNative(current => current || initialNative || current);
      setLearning(current => current || initialLearning || current);
    }
  }, [open, initialNative, initialLearning, initialTab]);

  if (!open) return null;

  const resetAndClose = () => {
    setError('');
    setStage('form');
    onClose();
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!native || !learning) { setError(t('setupModal.selectLanguagesError')); return; }
    if (native === learning)  { setError(t('liveExchange.sameLanguageError')); return; }
    if (!email || !password)  { setError(t('setupModal.emailPasswordRequired')); return; }

    setStage('saving');
    try {
      const { data: authData, error: signUpErr } = await supabase.auth.signUp({
        email:    email.trim().toLowerCase(),
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });

      if (signUpErr) { setError(signUpErr.message); setStage('form'); return; }

      if (!authData.session) {
        // Email confirmation required by this Supabase project — stop here.
        // No polling; the user returns to this same main screen after clicking the email link.
        setStage('confirm-email');
        return;
      }

      const sessionId = await resolveSessionId(email);
      await persistProfile({ sessionId, email, nativeLanguage: native, learningLanguage: learning });
      onComplete({ isSignup: true });
    } catch (err) {
      console.error('SetupModal signup error:', err);
      setError(t('setupModal.saveFailed'));
      setStage('form');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError(t('setupModal.emailPasswordRequired')); return; }

    setStage('saving');
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signInErr) { setError(t('setupModal.loginInvalid')); setStage('form'); return; }

      const profile = await lookupProfileByEmail(email);

      if (profile?.native_language && profile?.learning_language) {
        // Already fully set up — never re-ask.
        localStorage.setItem('mutua_session_id', profile.session_id);
              onComplete({ isSignup: false });
        return;
      }

      // Authenticated, but language pair missing — ask for just that, nothing else.
      setPendingSessionId(profile?.session_id ?? await resolveSessionId(email));
      setPendingEmail(email.trim().toLowerCase());
      setStage('login-needs-language');
    } catch (err) {
      console.error('SetupModal login error:', err);
      setError(t('setupModal.loginFailed'));
      setStage('form');
    }
  };

  const handleFinishLoginLanguage = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!native || !learning) { setError(t('setupModal.selectLanguagesError')); return; }
    if (native === learning)  { setError(t('liveExchange.sameLanguageError')); return; }

    setStage('saving');
    try {
      await persistProfile({
        sessionId: pendingSessionId, email: pendingEmail,
        nativeLanguage: native, learningLanguage: learning,
      });
      onComplete({ isSignup: false });
    } catch (err) {
      console.error('SetupModal finish-login error:', err);
      setError(t('setupModal.saveFailed'));
      setStage('login-needs-language');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/40">
      <div className="live-modal-card w-full max-w-sm rounded-2xl shadow-2xl p-6 relative">
        <button
          onClick={resetAndClose}
          aria-label={t('setup.close')}
          className="absolute top-3 right-3 opacity-60 hover:opacity-100 text-sm w-7 h-7 flex items-center justify-center"
        >
          ✕
        </button>

        {stage === 'confirm-email' && (
          <div className="text-center space-y-4 py-4">
            <p className="live-modal-title text-lg">{t('setup.confirmEmailTitle')}</p>
            <p className="live-subtitle text-sm leading-relaxed">
              {t('setup.confirmEmailBody')}
            </p>
            <button onClick={resetAndClose} className="w-full live-button-ghost justify-center text-sm">
              {t('setup.close')}
            </button>
          </div>
        )}

        {stage === 'login-needs-language' && (
          <form onSubmit={handleFinishLoginLanguage} className="space-y-4">
            <div>
              <p className="live-modal-title text-lg">{t('setup.almostThereTitle')}</p>
              <p className="live-subtitle text-sm mt-1">{t('setup.almostThereBody')}</p>
            </div>
            <LanguageFields native={native} learning={learning} setNative={setNative} setLearning={setLearning} />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button type="submit" className="w-full live-button justify-center text-sm">
              {t('setup.start')}
            </button>
          </form>
        )}

        {(stage === 'form' || stage === 'saving') && (
          <div className="space-y-5">
            <div className="live-modal-tabs flex rounded-full p-1 text-sm font-semibold">
              <button
                type="button"
                onClick={() => { setTab('signup'); setError(''); }}
                data-active={tab === 'signup'}
                className="live-modal-tab flex-1 py-1.5 rounded-full transition-colors"
              >
                {t('setup.signup')}
              </button>
              <button
                type="button"
                onClick={() => { setTab('login'); setError(''); }}
                data-active={tab === 'login'}
                className="live-modal-tab flex-1 py-1.5 rounded-full transition-colors"
              >
                {t('setup.login')}
              </button>
            </div>

            {tab === 'signup' ? (
              <form onSubmit={handleSignup} className="space-y-3">
                <LanguageFields native={native} learning={learning} setNative={setNative} setLearning={setLearning} />
                <input
                  type="email" required placeholder={t('setup.email')} value={email}
                  onChange={e => setEmail(e.target.value)} disabled={stage === 'saving'}
                  className="live-modal-input disabled:opacity-50"
                />
                <input
                  type="password" required placeholder={t('setup.password')} value={password}
                  onChange={e => setPassword(e.target.value)} disabled={stage === 'saving'}
                  className="live-modal-input disabled:opacity-50"
                />
                {error && <p className="text-xs text-red-600">{error}</p>}
                <SignupPrivacyNotice />
                <button
                  type="submit" disabled={stage === 'saving'}
                  className="w-full live-button justify-center text-sm"
                >
                  {stage === 'saving' ? t('setup.processing') : t('setup.start')}
                </button>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-3">
                <input
                  type="email" required placeholder={t('setup.email')} value={email}
                  onChange={e => setEmail(e.target.value)} disabled={stage === 'saving'}
                  className="live-modal-input disabled:opacity-50"
                />
                <input
                  type="password" required placeholder={t('setup.password')} value={password}
                  onChange={e => setPassword(e.target.value)} disabled={stage === 'saving'}
                  className="live-modal-input disabled:opacity-50"
                />
                {error && <p className="text-xs text-red-600">{error}</p>}
                <button
                  type="submit" disabled={stage === 'saving'}
                  className="w-full live-button justify-center text-sm"
                >
                  {stage === 'saving' ? t('setup.signingIn') : t('setup.login')}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function LanguageFields({
  native, learning, setNative, setLearning,
}: {
  native: Language | ''; learning: Language | '';
  setNative: (v: Language | '') => void; setLearning: (v: Language | '') => void;
}) {
  const { t } = useLocale();
  return (
    <div className="grid grid-cols-2 gap-2">
      <LanguagePicker value={native} onChange={setNative} placeholder={t('setup.nativePlaceholder')} />
      <LanguagePicker value={learning} onChange={setLearning} placeholder={t('setup.learningPlaceholder')} />
    </div>
  );
}
