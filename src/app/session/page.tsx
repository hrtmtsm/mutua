'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { MatchResult } from '@/lib/types';

const INITIAL_SECONDS = 3 * 60;
const EXTEND_SECONDS  = 5 * 60;

function formatTime(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function ControlBtn({
  active,
  activeClass,
  onClick,
  label,
  children,
}: {
  active: boolean;
  activeClass: string;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`w-12 h-12 rounded-lg border-2 border-neutral-600 flex items-center justify-center transition-all ${
        active ? activeClass : 'bg-neutral-800 hover:bg-neutral-700'
      }`}
    >
      {children}
    </button>
  );
}

export default function SessionPage() {
  const router = useRouter();
  const [match,     setMatch]     = useState<MatchResult | null>(null);
  const [seconds,   setSeconds]   = useState(INITIAL_SECONDS);
  const [running,   setRunning]   = useState(true);
  const [timeUp,    setTimeUp]    = useState(false);
  const [muted,     setMuted]     = useState(false);
  const [cameraOn,  setCameraOn]  = useState(false);
  const [promptIdx, setPromptIdx] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem('mutua_match');
    if (!stored) { router.replace('/onboarding'); return; }
    setMatch(JSON.parse(stored));
  }, [router]);

  useEffect(() => {
    if (!running) return;
    if (seconds <= 0) { setTimeUp(true); setRunning(false); return; }
    const t = setInterval(() => setSeconds(s => s - 1), 1000);
    return () => clearInterval(t);
  }, [running, seconds]);

  const handleExtend = useCallback(() => {
    setSeconds(EXTEND_SECONDS);
    setRunning(true);
    setTimeUp(false);
  }, []);

  const handleEnd = useCallback(() => {
    localStorage.removeItem('mutua_match');
    router.push('/');
  }, [router]);

  if (!match) return null;

  const { partner, starters } = match;
  const urgent = seconds <= 30 && !timeUp;

  return (
    <div className="relative min-h-screen flex flex-col bg-neutral-950 text-white">

      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between border-b-2 border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg border-2 border-amber-400 bg-amber-400 flex items-center justify-center text-xs font-black text-neutral-900 shrink-0">
            {partner.native_language.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">
              Native {partner.native_language} speaker
            </p>
            <p className="text-xs text-neutral-400 mt-0.5">
              Learning {partner.learning_language} · {partner.comm_style}
            </p>
          </div>
        </div>

        <div
          className={`font-serif font-black text-2xl tabular-nums transition-colors ${
            urgent ? 'text-red-400' : 'text-amber-400'
          }`}
        >
          {formatTime(seconds)}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 gap-5">

        {/* Video area */}
        <div className="w-full max-w-md aspect-video bg-neutral-900 rounded-xl border-2 border-neutral-800 flex items-center justify-center relative">
          <div className="text-center space-y-1.5">
            <p className="text-neutral-400 text-sm font-medium">
              {cameraOn ? 'Camera on' : 'Voice only — camera off'}
            </p>
            <p className="text-xs text-neutral-700">
              Add Daily.co or LiveKit for real calls
            </p>
          </div>
          <div className="absolute bottom-3 right-3 w-20 h-14 bg-neutral-800 rounded-lg border border-neutral-700 flex items-center justify-center">
            <span className="text-xs text-neutral-500 font-medium">You</span>
          </div>
        </div>

        {/* Prompt card */}
        <div className="w-full max-w-md bg-neutral-900 border-2 border-neutral-700 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">
              Prompt
            </span>
            {starters.length > 1 && (
              <button
                onClick={() => setPromptIdx(i => (i + 1) % starters.length)}
                className="text-xs text-amber-400 hover:text-amber-300 font-semibold transition-colors"
              >
                Next &rarr;
              </button>
            )}
          </div>
          <p className="text-sm text-neutral-200 leading-relaxed">
            &ldquo;{starters[promptIdx] ?? 'Tell your partner something interesting about your culture.'}&rdquo;
          </p>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 justify-center">
          {[partner.goal, partner.availability].map(tag => (
            <span
              key={tag}
              className="px-3 py-1 bg-neutral-900 text-neutral-400 text-xs font-medium border border-neutral-700 rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="px-6 py-5 border-t-2 border-neutral-800">
        <div className="flex items-center justify-center gap-4 mb-3">
          <ControlBtn
            active={muted}
            activeClass="bg-red-900 border-red-600 text-red-400"
            onClick={() => setMuted(m => !m)}
            label={muted ? 'Unmute' : 'Mute'}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              {muted
                ? <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
                : <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
              }
            </svg>
          </ControlBtn>

          <ControlBtn
            active={cameraOn}
            activeClass="bg-neutral-700 border-neutral-500"
            onClick={() => setCameraOn(c => !c)}
            label={cameraOn ? 'Turn off camera' : 'Turn on camera'}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              {cameraOn
                ? <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                : <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/>
              }
            </svg>
          </ControlBtn>

          <button
            onClick={handleEnd}
            title="End session"
            className="w-12 h-12 rounded-lg border-2 border-red-800 bg-red-950 hover:bg-red-900 flex items-center justify-center transition-colors"
          >
            <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08C.11 12.9 0 12.65 0 12.38c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .27-.11.52-.29.7l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28-.79-.73-1.68-1.36-2.66-1.85-.33-.16-.56-.51-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
            </svg>
          </button>
        </div>

        <p className="text-center text-xs text-neutral-700">
          Voice/video requires Daily.co or LiveKit integration
        </p>
      </div>

      {/* Time-up modal */}
      {timeUp && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center px-6 z-10">
          <div className="bg-neutral-950 border-2 border-neutral-700 rounded-2xl p-8 max-w-sm w-full text-center shadow-[6px_6px_0_0_#fbbf24] space-y-6">
            <div>
              <h2 className="font-serif font-black text-2xl mb-2">Time&rsquo;s up</h2>
              <p className="text-sm text-neutral-400">
                Good conversation! Would you like to keep going?
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleExtend}
                className="w-full py-3 bg-amber-400 text-neutral-900 border-2 border-amber-400 font-bold rounded-lg hover:bg-amber-300 transition-colors"
              >
                Extend 5 more minutes
              </button>
              <button
                onClick={handleEnd}
                className="w-full py-3 bg-neutral-900 border-2 border-neutral-700 text-neutral-300 font-medium rounded-lg hover:bg-neutral-800 transition-colors"
              >
                End session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
