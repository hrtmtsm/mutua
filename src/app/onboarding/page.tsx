'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LANGUAGES, GOALS, COMM_STYLES, FREQUENCY,
  type Language, type Goal, type CommStyle, type Frequency, type UserProfile,
} from '@/lib/types';
import { GOAL_DETAILS, COMM_STYLE_DETAILS, FREQUENCY_DETAILS } from '@/lib/constants';
import { saveProfile, saveToWaitlist } from '@/lib/supabase';

// ---- sub-components --------------------------------------------------------

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="w-full bg-sky-100 h-1">
      <div
        className="bg-[#2B8FFF] h-1 transition-all duration-500 ease-out"
        style={{ width: `${(step / total) * 100}%` }}
      />
    </div>
  );
}

function OptionCard({
  label,
  description,
  selected,
  onClick,
}: {
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-5 py-4 rounded-xl border transition-all ${
        selected
          ? 'border-[#2B8FFF] bg-sky-50'
          : 'border-stone-200 bg-white hover:border-[#2B8FFF]'
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className={`font-semibold text-sm ${selected ? 'text-[#2B8FFF]' : 'text-stone-700'}`}>
            {label}
          </p>
          <p className="text-xs text-stone-400 mt-0.5">{description}</p>
        </div>
        <div
          className={`w-4 h-4 rounded-full border-2 shrink-0 transition-all ${
            selected ? 'border-[#2B8FFF] bg-[#2B8FFF]' : 'border-stone-300'
          }`}
        />
      </div>
    </button>
  );
}

function LangCard({
  lang,
  selected,
  onClick,
}: {
  lang: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${
        selected
          ? 'border-[#2B8FFF] bg-sky-50 text-[#2B8FFF]'
          : 'border-stone-200 bg-white text-stone-700 hover:border-[#2B8FFF]'
      }`}
    >
      {lang}
    </button>
  );
}

// ---- page ------------------------------------------------------------------

const QUESTIONS = [
  'What is your native language?',
  'Which language do you want to practice?',
  'Why do you want to practice this language?',
  'How would you like to practice?',
  'How often do you want to practice?',
  'What\'s your email?',
];

const SUBTITLES = [
  'The language you speak most fluently.',
  'Your partner will be a native speaker of this language.',
  'We use this to find a partner with the same purpose.',
  'We match you with someone who prefers the same format.',
  'We match you with someone who has the same commitment level.',
  'We\'ll notify you when your partner is ready.',
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step,    setStep]    = useState(1);
  const [saving,  setSaving]  = useState(false);

  const [native,             setNative]            = useState<Language | null>(null);
  const [learning,           setLearning]          = useState<Language | null>(null);
  const [goal,               setGoal]              = useState<Goal | null>(null);
  const [commStyle,          setCommStyle]         = useState<CommStyle | null>(null);
  const [practiceFrequency,  setPracticeFrequency] = useState<Frequency | null>(null);
  const [email,              setEmail]             = useState('');

  const canAdvance =
    (step === 1 && native !== null) ||
    (step === 2 && learning !== null) ||
    (step === 3 && goal !== null) ||
    (step === 4 && commStyle !== null) ||
    (step === 5 && practiceFrequency !== null) ||
    (step === 6 && /\S+@\S+\.\S+/.test(email));

  const handleNext = async () => {
    if (step < 6) { setStep(s => s + 1); return; }

    setSaving(true);
    const sessionId = crypto.randomUUID();
    localStorage.setItem('mutua_session_id', sessionId);

    const profile: UserProfile = {
      session_id:         sessionId,
      email:              email.trim().toLowerCase(),
      native_language:    native!,
      learning_language:  learning!,
      goal:               goal!,
      comm_style:         commStyle!,
      practice_frequency: practiceFrequency!,
    };
    localStorage.setItem('mutua_profile', JSON.stringify(profile));

    try { await saveProfile(profile); } catch (err) { console.error('saveProfile error:', err); }

    try {
      await saveToWaitlist({
        email:                profile.email!,
        native_language:      profile.native_language,
        target_language:      profile.learning_language,
        goal:                 profile.goal,
        communication_style:  profile.comm_style,
        practice_frequency:   profile.practice_frequency,
      });
    } catch (err) { console.error('saveToWaitlist error:', err); }

    router.push('/waitlist');
  };

  return (
    <div className="min-h-screen flex flex-col">

      {/* Nav */}
      <div className="px-8 py-5 flex items-center justify-between border-b border-stone-100">
        <span className="font-serif font-black text-xl tracking-tight text-neutral-900">Mutua</span>
        <span className="text-xs font-semibold text-stone-400 tabular-nums tracking-widest">
          {step} / 6
        </span>
      </div>
      <ProgressBar step={step} total={6} />

      {/* Content */}
      <main className="flex-1 flex flex-col px-6 py-10 max-w-md mx-auto w-full">

        {/* Card wrapper */}
        <div className="bg-white border border-stone-200 rounded-2xl shadow-sm p-6 mb-6">

          {/* Question heading */}
          <div className="mb-6">
            <h2 className="font-serif font-black text-2xl text-neutral-900 leading-snug mb-1">
              {QUESTIONS[step - 1]}
            </h2>
            <p className="text-sm text-stone-500">{SUBTITLES[step - 1]}</p>
          </div>

          {/* Q1 — Native language */}
          {step === 1 && (
            <div className="grid grid-cols-2 gap-2">
              {LANGUAGES.map(lang => (
                <LangCard key={lang} lang={lang} selected={native === lang} onClick={() => setNative(lang)} />
              ))}
            </div>
          )}

          {/* Q2 — Target language */}
          {step === 2 && (
            <div className="grid grid-cols-2 gap-2">
              {LANGUAGES.filter(l => l !== native).map(lang => (
                <LangCard key={lang} lang={lang} selected={learning === lang} onClick={() => setLearning(lang)} />
              ))}
            </div>
          )}

          {/* Q3 — Goal */}
          {step === 3 && (
            <div className="space-y-2">
              {GOALS.map(g => (
                <OptionCard key={g} label={g} description={GOAL_DETAILS[g]} selected={goal === g} onClick={() => setGoal(g)} />
              ))}
            </div>
          )}

          {/* Q4 — Communication style */}
          {step === 4 && (
            <div className="space-y-2">
              {COMM_STYLES.map(s => (
                <OptionCard key={s} label={s} description={COMM_STYLE_DETAILS[s]} selected={commStyle === s} onClick={() => setCommStyle(s)} />
              ))}
            </div>
          )}

          {/* Q5 — Practice frequency */}
          {step === 5 && (
            <div className="space-y-2">
              {FREQUENCY.map(f => (
                <OptionCard key={f} label={f} description={FREQUENCY_DETAILS[f]} selected={practiceFrequency === f} onClick={() => setPracticeFrequency(f)} />
              ))}
            </div>
          )}

          {/* Q6 — Email */}
          {step === 6 && (
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm text-neutral-900 placeholder:text-stone-400 focus:outline-none focus:border-[#2B8FFF]"
            />
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          {step > 1 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="px-5 py-3 border border-stone-200 bg-white text-neutral-900 text-sm font-semibold rounded-xl hover:border-stone-400 transition-all"
            >
              Back
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={!canAdvance || saving}
            className="flex-1 px-6 py-3 btn-primary text-white text-sm font-bold rounded-xl shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : step === 6 ? 'Start speaking' : 'Continue'}
          </button>
        </div>
      </main>
    </div>
  );
}
