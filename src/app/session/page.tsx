'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { MatchResult } from '@/lib/types';
import { LANG_FLAGS } from '@/lib/constants';
import { Check, Mic, MicOff, MessageSquare, Video, VideoOff, PhoneOff } from 'lucide-react';
import {
  type Prompt,
  type Pools,
  getT,
  selectPrompts,
  buildFallbackPool,
  fetchSessionPool,
  recordShownPrompt,
} from '@/lib/promptsDb';
import { isConfigured } from '@/lib/supabase';

// ── Helpers ───────────────────────────────────────────────────────────────────

type Phase = 'ice' | 'conv' | 'reflect';

function getPhase(s: number): Phase {
  if (s < 3 * 60)  return 'ice';
  if (s < 10 * 60) return 'conv';
  return 'reflect';
}

function formatTime(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

const CHECKPOINT = 15 * 60;

// ── Checklist items ───────────────────────────────────────────────────────────

const CHECKLIST_ITEMS: Prompt[] = [
  {
    t: {
      English:    "Introduce each other.",
      Japanese:   "お互いに自己紹介しましょう。",
      Korean:     "서로 자기소개를 해봐요。",
      Mandarin:   "我们来互相介绍一下吧。",
      Spanish:    "Preséntense el uno al otro.",
      French:     "Présentez-vous mutuellement.",
      Portuguese: "Apresentem-se um ao outro.",
      German:     "Stellt euch gegenseitig vor.",
      Italian:    "Presentatevi a vicenda.",
      Arabic:     "قدِّم نفسك للآخر.",
    },
  },
  {
    t: {
      English:    "What do you want to get out of today?",
      Japanese:   "今日のセッションで何を練習したいですか？",
      Korean:     "오늘 무엇을 연습하고 싶으세요?",
      Mandarin:   "今天你最想练习什么？",
      Spanish:    "¿Qué quieres practicar hoy?",
      French:     "Qu'est-ce que vous voulez pratiquer aujourd'hui\u00a0?",
      Portuguese: "O que você quer praticar hoje?",
      German:     "Was möchtest du heute üben?",
      Italian:    "Cosa vuoi praticare oggi?",
      Arabic:     "ماذا تريد أن تتدرب عليه اليوم؟",
    },
  },
];

const CHECKLIST_CELEBRATIONS: Prompt[] = [
  {
    t: {
      English:    "Nice! You're getting closer.",
      Japanese:   "いい感じ！距離が縮まってきました。",
      Korean:     "좋아요! 가까워지고 있어요.",
      Mandarin:   "很好！你们越来越熟了。",
      Spanish:    "¡Bien! Cada vez más cerca.",
      French:     "Super\u00a0! Vous vous rapprochez.",
      Portuguese: "Ótimo! Vocês estão se aproximando.",
      German:     "Super! Ihr kommt euch näher.",
      Italian:    "Ottimo! Vi state avvicinando.",
      Arabic:     "رائع! أنتما تتقاربان.",
    },
  },
  {
    t: {
      English:    "You're all set. Let's talk.",
      Japanese:   "準備完了！話しましょう。",
      Korean:     "준비됐어요. 얘기해 봐요.",
      Mandarin:   "准备好了，开始聊吧。",
      Spanish:    "Listos. A hablar.",
      French:     "Vous êtes prêts. À vous\u00a0!",
      Portuguese: "Tudo pronto. Vamos conversar.",
      German:     "Alles bereit. Los geht's.",
      Italian:    "Tutto pronto. Parliamo.",
      Arabic:     "أنتما مستعدان. لنتحدث.",
    },
  },
];

// ── PartnerTile (full-screen) ─────────────────────────────────────────────────

function PartnerTile({
  initials, isSpeaking, avatarUrl,
}: {
  initials: string;
  isSpeaking: boolean;
  avatarUrl?: string;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-[#2B8FFF]">

      {/* ── Background: blurred, saturated, lowered-opacity profile ── */}
      {avatarUrl ? (
        /* Real profile photo — scale to fill, blur, saturate */
        <img
          src={avatarUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: 'blur(28px) saturate(1.5) brightness(0.8)', transform: 'scale(1.1)' }}
        />
      ) : (
        /*
         * No photo: render the avatar circle itself at 100vmax so it
         * covers every corner of the container, then blur + saturate it.
         * The white initials create a subtle lighter centre so it doesn't
         * read as a flat colour fill.
         */
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#2B8FFF] flex items-center justify-center"
          style={{
            width: '100vmax',
            height: '100vmax',
            filter: 'blur(32px) saturate(1.5) brightness(0.82) opacity(0.9)',
          }}
        >
          <span
            className="font-black text-white select-none pointer-events-none"
            style={{ fontSize: '28vmin', lineHeight: 1 }}
          >
            {initials}
          </span>
        </div>
      )}

      {/* Speaking halo */}
      {isSpeaking && (
        <div className="absolute w-44 h-44 rounded-full bg-white/20 animate-speak-pulse" />
      )}
      {/* Foreground avatar — frosted so it lifts off the blurred background */}
      <div className={`
        relative w-28 h-28 rounded-full
        bg-white/20 backdrop-blur-md ring-2 ring-white/40
        flex items-center justify-center font-black text-white text-3xl select-none
        transition-transform duration-200 ${isSpeaking ? 'scale-110' : ''}
      `}>
        {initials}
      </div>
    </div>
  );
}

// ── SelfPIP ───────────────────────────────────────────────────────────────────

function SelfPIP({
  cameraOn, videoRef, isSpeaking, haloRef, positionClass,
}: {
  cameraOn:  boolean;
  videoRef:  React.RefObject<HTMLVideoElement>;
  isSpeaking: boolean;
  haloRef:   React.RefObject<HTMLDivElement>;
  positionClass?: string;
}) {
  return (
    <div
      className={`${positionClass ?? 'absolute bottom-4 right-3 z-10'} w-[118px] rounded-2xl overflow-hidden`}
      style={{ aspectRatio: '3/4' }}
    >
      {cameraOn ? (
        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
      ) : (
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-[#2B8FFF]">
          {/* Blurred profile background — same treatment as partner tile */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#2B8FFF] flex items-center justify-center"
            style={{
              width: '200%',
              aspectRatio: '1',
              filter: 'blur(22px) saturate(1.5) brightness(0.82)',
            }}
          >
            <span
              className="font-black text-white select-none pointer-events-none"
              style={{ fontSize: '60px', lineHeight: 1, opacity: 0.9 }}
            >
              YO
            </span>
          </div>
          {/* Speaking halo — driven directly by mic volume via ref */}
          <div
            ref={haloRef}
            className="absolute w-16 h-16 rounded-full bg-white/30"
            style={{ opacity: 0, transform: 'scale(1)', transformOrigin: 'center', willChange: 'transform, opacity' }}
          />
          {/* Frosted avatar */}
          <div className="relative w-12 h-12 rounded-full bg-white/20 backdrop-blur-md ring-2 ring-white/40 flex items-center justify-center font-bold text-white text-sm select-none">
            You
          </div>
        </div>
      )}
      {/* Name label */}
      <div className="absolute bottom-2 left-0 right-0 flex justify-center pointer-events-none">
        <span className="text-[10px] font-semibold text-white/80 bg-black/25 backdrop-blur-sm px-2 py-0.5 rounded-full">
          You
        </span>
      </div>
    </div>
  );
}

// ── SessionPage ───────────────────────────────────────────────────────────────
export default function SessionPage() {
  const router = useRouter();

  const [match,            setMatch]            = useState<MatchResult | null>(null);
  const [seconds,          setSeconds]          = useState(0);
  const [checkpoint,       setCheckpoint]       = useState(false);
  const [muted,            setMuted]            = useState(false);
  const [cameraOn,         setCameraOn]         = useState(false);
  const [chatOpen,         setChatOpen]         = useState(false);
  const [promptIdx,        setPromptIdx]        = useState(0);
  const [message,          setMessage]          = useState('');
  const [messages,         setMessages]         = useState<string[]>([]);
  const [checklistStep,        setChecklistStep]        = useState(0);
  const [checklistCelebrating, setChecklistCelebrating] = useState(false);
  const [checklistDone,        setChecklistDone]        = useState(false);
  const [pillsChecked,         setPillsChecked]         = useState<[boolean, boolean]>([false, false]);
  const [activeTurn,           setActiveTurn]           = useState<'learning' | 'native'>('learning');
  const [turnSwitched,         setTurnSwitched]         = useState(false);
  const [difficulty,           setDifficulty]           = useState(1);

  const [youSpeaking,     setYouSpeaking]     = useState(false);
  const [isOnline,        setIsOnline]        = useState(true);
  const [micBlocked,      setMicBlocked]      = useState(false);
  const [showEndConfirm,  setShowEndConfirm]  = useState(false);
  const partnerSpeaking = false;

  const videoRef           = useRef<HTMLVideoElement>(null);
  const streamRef          = useRef<MediaStream | null>(null);
  const audioCtxRef        = useRef<AudioContext | null>(null);
  const audioStreamRef     = useRef<MediaStream | null>(null);
  const animFrameRef       = useRef<number>(0);
  const selfHaloRef        = useRef<HTMLDivElement>(null);
  const prevPhaseRef       = useRef<Phase>('ice');
  const messagesEndRef     = useRef<HTMLDivElement>(null);
  const promptChangedAtRef = useRef<number>(Date.now());

  const [pool, setPool] = useState<Pools>(() => buildFallbackPool(''));

  useEffect(() => {
    const stored = localStorage.getItem('mutua_match');
    if (!stored) { router.replace('/onboarding'); return; }
    const parsed = JSON.parse(stored) as MatchResult;
    setMatch(parsed);
    setPool(buildFallbackPool(parsed.partner.goal));

    if (isConfigured) {
      const myId      = localStorage.getItem('mutua_session_id') ?? '';
      const partnerId = parsed.partner.session_id;
      fetchSessionPool(myId, partnerId, parsed.partner.goal)
        .then(p => setPool(p))
        .catch(() => { /* keep fallback */ });
    }
  }, [router]);

  useEffect(() => {
    const t = setInterval(() => {
      setSeconds(s => {
        const next = s + 1;
        if (next === CHECKPOINT) setCheckpoint(true);
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const phase = getPhase(seconds);
  useEffect(() => {
    if (phase !== prevPhaseRef.current) {
      prevPhaseRef.current = phase;
      setPromptIdx(0);
      setActiveTurn('learning');
      setTurnSwitched(false);
    }
  }, [phase]);

  useEffect(() => {
    if (!cameraOn) {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setCameraOn(false));
  }, [cameraOn]);

  useEffect(() => {
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  // ── Mic volume detection → youSpeaking ────────────────────────────────────
  useEffect(() => {
    if (muted) {
      setYouSpeaking(false);
      if (selfHaloRef.current) { selfHaloRef.current.style.opacity = '0'; selfHaloRef.current.style.transform = 'scale(1)'; }
      cancelAnimationFrame(animFrameRef.current);
      audioStreamRef.current?.getTracks().forEach(t => t.stop());
      audioCtxRef.current?.close();
      audioStreamRef.current = null;
      audioCtxRef.current    = null;
      return;
    }

    let cancelled = false;

    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then(stream => {
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        setMicBlocked(false);
        audioStreamRef.current = stream;

        // If the mic track ends unexpectedly (device disconnected etc.), auto-mute
        stream.getAudioTracks()[0]?.addEventListener('ended', () => {
          if (!cancelled) setMuted(true);
        });

        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const buf = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          // Resume if browser suspended the AudioContext (e.g. tab backgrounded)
          if (ctx.state === 'suspended') ctx.resume();
          analyser.getByteFrequencyData(buf);
          const rms = Math.sqrt(buf.reduce((s, v) => s + v * v, 0) / buf.length);
          const speaking = rms > 40;
          setYouSpeaking(speaking);
          // Drive halo directly — no re-render, smooth 60fps
          if (selfHaloRef.current) {
            if (speaking) {
              const norm = Math.min(1, (rms - 40) / 70);
              selfHaloRef.current.style.opacity  = String(0.1 + norm * 0.3);
              selfHaloRef.current.style.transform = `scale(${1 + norm * 0.5})`;
            } else {
              selfHaloRef.current.style.opacity  = '0';
              selfHaloRef.current.style.transform = 'scale(1)';
            }
          }
          animFrameRef.current = requestAnimationFrame(tick);
        };
        tick();
      })
      .catch(() => { setMicBlocked(true); });

    return () => {
      cancelled = true;
      cancelAnimationFrame(animFrameRef.current);
      audioStreamRef.current?.getTracks().forEach(t => t.stop());
      audioCtxRef.current?.close();
      audioStreamRef.current = null;
      audioCtxRef.current    = null;
      setYouSpeaking(false);
    };
  }, [muted]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Online / offline detection ─────────────────────────────────────────────
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const onOnline  = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const handleEnd = useCallback(() => {
    // Update streak
    const today = new Date().toDateString();
    const raw = localStorage.getItem('mutua_streak');
    if (raw) {
      const { lastDate, count } = JSON.parse(raw);
      const yesterday = new Date(Date.now() - 86_400_000).toDateString();
      const newCount = lastDate === today ? count : lastDate === yesterday ? count + 1 : 1;
      localStorage.setItem('mutua_streak', JSON.stringify({ lastDate: today, count: newCount }));
    } else {
      localStorage.setItem('mutua_streak', JSON.stringify({ lastDate: today, count: 1 }));
    }
    // Save lightweight session metadata for review screen + history
    const pName = match?.partner.name ?? 'Your partner';
    const sessionEntry = {
      partnerName: pName,
      partnerId:   match?.partner.session_id ?? '',
      duration:    seconds,
      date:        new Date().toISOString(),
    };
    localStorage.setItem('mutua_last_session', JSON.stringify(sessionEntry));
    const history = JSON.parse(localStorage.getItem('mutua_history') ?? '[]');
    history.unshift(sessionEntry);
    localStorage.setItem('mutua_history', JSON.stringify(history.slice(0, 50)));
    localStorage.removeItem('mutua_match');
    router.push('/session-review');
  }, [router, seconds, match]);

  const handleSwitchTurn = useCallback(() => {
    setActiveTurn(t => t === 'learning' ? 'native' : 'learning');
    setTurnSwitched(t => !t);
    promptChangedAtRef.current = Date.now();
  }, []);

  const handleNext = useCallback(() => {
    setPromptIdx(i => i + 1);
    setTurnSwitched(false);
    setDifficulty(d => Math.min(3, +(d + 0.33).toFixed(2)));
    promptChangedAtRef.current = Date.now();
  }, []);

  const handleChangeTopic = useCallback(() => {
    setPromptIdx(i => i + 1);
    setDifficulty(d => Math.max(1, +(d - 0.5).toFixed(2)));
    promptChangedAtRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (!checklistDone) return;
    const t = setInterval(() => {
      if (Date.now() - promptChangedAtRef.current >= 3 * 60 * 1000) {
        handleNext();
      }
    }, 30_000);
    return () => clearInterval(t);
  }, [checklistDone, handleNext]);

  useEffect(() => {
    if (!checklistDone) return;
    const promptId = currentPrompt?.id;
    if (!promptId) return;
    const myId      = localStorage.getItem('mutua_session_id') ?? '';
    const partnerId = match?.partner.session_id ?? '';
    if (!myId || !partnerId) return;
    recordShownPrompt(myId, partnerId, promptId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptIdx, phase, checklistDone]);

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    setMessages(prev => [...prev, trimmed]);
    setMessage('');
  };

  if (!match) return null;

  const { partner } = match;
  const partnerName = partner.name ?? 'Your partner';

  const handlePillCheck = (pillIndex: 0 | 1) => {
    if (checklistCelebrating) return;
    const next: [boolean, boolean] = [pillsChecked[0], pillsChecked[1]];
    next[pillIndex] = true;
    setPillsChecked(next);
    if (next[0] && next[1]) {
      setChecklistCelebrating(true);
      setTimeout(() => {
        setChecklistCelebrating(false);
        setPillsChecked([false, false]);
        if (checklistStep < CHECKLIST_ITEMS.length - 1) {
          setChecklistStep(s => s + 1);
        } else {
          setChecklistDone(true);
        }
      }, 1800);
    }
  };

  // Prompt resolution — filtered by current difficulty
  const phasePool    = pool[phase];
  const maxLevel     = Math.ceil(difficulty) as 1 | 2 | 3;
  const activePool   = phasePool.filter(p => (p.level ?? 2) <= maxLevel);
  const currentPool  = activePool.length > 0 ? activePool : phasePool;
  const currentPrompt = currentPool[promptIdx % currentPool.length];
  const learningText  = getT(currentPrompt, partner.learning_language);
  const nativeText    = getT(currentPrompt, partner.native_language);

  // Turn-based display
  const phaseLabel    = phase === 'ice' ? 'Warm up' : phase === 'conv' ? 'Talk about this' : 'Wrap up';
  const activeLang    = activeTurn === 'learning' ? partner.learning_language : partner.native_language;
  const activeFlag    = LANG_FLAGS[activeLang] ?? '';
  const activeText    = activeTurn === 'learning' ? learningText : nativeText;
  const turnGuidance  = activeTurn === 'learning'
    ? `${partnerName} speaks · You help`
    : `You speak · ${partnerName} helps`;

  // ── Shared prompt card (rendered in both floating overlay and sidebar) ────────

  const promptCard = !checklistDone ? (
    checklistCelebrating ? (
      /* ── Celebration ── */
      <div className="rounded-2xl bg-white/95 backdrop-blur-sm shadow-xl overflow-hidden">
        <div className="px-4 py-5 flex flex-col items-center text-center gap-1.5">
          <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mb-1">
            <Check className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-[15px] font-bold text-neutral-900 leading-snug">
            {getT(CHECKLIST_CELEBRATIONS[checklistStep], partner.learning_language)}
          </p>
          <p className="text-[13px] text-stone-400 leading-snug">
            {getT(CHECKLIST_CELEBRATIONS[checklistStep], partner.native_language)}
          </p>
        </div>
      </div>
    ) : (
      /* ── Two-pill checklist card ── */
      <div className="rounded-2xl bg-white/95 backdrop-blur-sm shadow-xl overflow-hidden">

        {/* Header */}
        <div className="px-4 pt-3 pb-2 flex items-center justify-between">
          <span className="text-sm font-bold text-neutral-900">Break the ice</span>
          <span className="text-xs text-stone-400">{checklistStep + 1} of {CHECKLIST_ITEMS.length}</span>
        </div>

        {/* Learning language pill */}
        <button
          onClick={() => handlePillCheck(0)}
          disabled={pillsChecked[0]}
          className={`mx-3 w-[calc(100%-1.5rem)] text-left rounded-xl bg-stone-50 px-3 py-2.5 flex items-center gap-3 transition-opacity ${pillsChecked[0] ? 'opacity-50' : 'hover:bg-stone-100 active:bg-stone-100'}`}
        >
          <div className="w-6 h-6 rounded-full bg-neutral-700 flex items-center justify-center shrink-0 self-start mt-0.5">
            <span className="text-[9px] font-black text-white leading-none">You</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-sm leading-none">{LANG_FLAGS[partner.learning_language]}</span>
              <span className="text-[11px] font-semibold text-stone-500">{partner.learning_language}</span>
            </div>
            <p className={`text-[15px] font-bold leading-snug ${pillsChecked[0] ? 'line-through text-stone-400' : 'text-neutral-900'}`}>
              {getT(CHECKLIST_ITEMS[checklistStep], partner.learning_language)}
            </p>
          </div>
          <div className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${pillsChecked[0] ? 'bg-emerald-500 border-emerald-500' : 'border-stone-300'}`}>
            {pillsChecked[0] && (
              <Check className="w-3 h-3 text-white" />
            )}
          </div>
        </button>

        {/* Native language pill */}
        <button
          onClick={() => handlePillCheck(1)}
          disabled={pillsChecked[1]}
          className={`mx-3 mt-2 mb-3 w-[calc(100%-1.5rem)] text-left rounded-xl bg-stone-50 px-3 py-2.5 flex items-center gap-3 transition-opacity ${pillsChecked[1] ? 'opacity-50' : 'hover:bg-stone-100 active:bg-stone-100'}`}
        >
          <div className="w-6 h-6 rounded-full bg-[#2B8FFF] flex items-center justify-center shrink-0 self-start mt-0.5">
            <span className="text-[9px] font-black text-white leading-none">
              {partnerName.trim().slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-sm leading-none">{LANG_FLAGS[partner.native_language]}</span>
              <span className="text-[11px] font-semibold text-stone-500">{partner.native_language}</span>
            </div>
            <p className={`text-[15px] font-bold leading-snug ${pillsChecked[1] ? 'line-through text-stone-400' : 'text-neutral-900'}`}>
              {getT(CHECKLIST_ITEMS[checklistStep], partner.native_language)}
            </p>
          </div>
          <div className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${pillsChecked[1] ? 'bg-emerald-500 border-emerald-500' : 'border-stone-300'}`}>
            {pillsChecked[1] && (
              <Check className="w-3 h-3 text-white" />
            )}
          </div>
        </button>

      </div>
    )
  ) : (
    /* ── Turn-based prompt card ── */
    <div className="rounded-2xl bg-white/95 backdrop-blur-sm shadow-xl overflow-hidden">

      {/* Content */}
      <div className="px-4 pt-3 pb-3">

        {/* Stage label */}
        <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2">{phaseLabel}</p>

        {/* Language + speaking role */}
        <div className="flex items-center gap-2 mb-2.5">
          <span className="text-base leading-none">{activeFlag}</span>
          <span className="text-[14px] font-bold text-neutral-800">{activeLang}</span>
          <span className="text-[12px] text-stone-500">· {turnGuidance}</span>
        </div>

        {/* Main prompt — dominant */}
        <p className="text-[19px] font-bold text-neutral-900 leading-snug mb-2">{activeText}</p>

        {/* Follow-up hint */}
        {currentPrompt.hint && (
          <p className="text-[12px] text-stone-500 leading-relaxed">
            Follow-up: {currentPrompt.hint}
          </p>
        )}

      </div>

      {/* CTA zone */}
      <div className="px-4 pb-3 pt-2 border-t border-stone-100 flex items-center justify-between gap-3">
        <button
          onClick={handleChangeTopic}
          className="text-sm text-stone-400 hover:text-stone-600 transition-colors"
        >
          Change topic
        </button>
        {!turnSwitched ? (
          <button
            onClick={handleSwitchTurn}
            className="px-4 py-2 btn-primary text-white font-semibold text-sm rounded-xl" style={{ boxShadow: 'none' }}
          >
            Switch turn ↔
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={handleSwitchTurn}
              className="text-sm text-stone-400 hover:text-neutral-600 font-medium transition-colors"
            >
              Switch turns ↔
            </button>
            <button
              onClick={handleNext}
              className="px-4 py-2 btn-primary text-white font-semibold text-sm rounded-xl" style={{ boxShadow: 'none' }}
            >
              Next topic →
            </button>
          </div>
        )}
      </div>

    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col bg-[#2B8FFF] overflow-hidden">

      {/* ── Offline banner ── */}
      {!isOnline && (
        <div className="shrink-0 bg-neutral-900 text-white text-xs font-medium text-center py-1.5 px-4 z-50">
          No internet connection — reconnecting…
        </div>
      )}

      {/* ── Mic blocked nudge ── */}
      {micBlocked && !muted && (
        <div className="shrink-0 bg-amber-500 text-white text-xs font-medium text-center py-1.5 px-4 z-50">
          Microphone access blocked — voice detection unavailable
        </div>
      )}

      {/* ── Content: participant area + right sidebar ── */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0">

        {/* ── Participant area ── */}
        <div className={`flex flex-col ${chatOpen ? 'h-[38%] flex-none md:h-auto md:flex-1' : 'flex-1'}`}>

          {/* Partner tile + overlays — fills remaining space */}
          <div className="relative flex-1 overflow-hidden">
            <PartnerTile
              initials={partnerName.trim().slice(0, 2).toUpperCase()}
              isSpeaking={partnerSpeaking}
              avatarUrl={partner.avatar_url}
            />

            {/* Top bar — transparent overlay */}
            <div className="absolute top-0 left-0 right-0 z-10 px-5 py-4 flex items-center justify-between">
              <div>
                <p className="font-bold text-white text-base leading-tight">{partnerName}</p>
                <p className="text-xs text-white/60 mt-0.5">
                  {LANG_FLAGS[partner.native_language]} Native {partner.native_language}
                </p>
              </div>
              <span className="font-mono text-sm text-white/50 tabular-nums">{formatTime(seconds)}</span>
            </div>

            {/* Mobile: SelfPIP + prompt card stacked at bottom-right */}
            {!chatOpen && (
              <div className="md:hidden absolute bottom-3 left-3 right-3 z-10 flex flex-col items-end gap-2">
                <SelfPIP cameraOn={cameraOn} videoRef={videoRef} isSpeaking={youSpeaking} haloRef={selfHaloRef} positionClass="relative" />
                <div className="w-full">{promptCard}</div>
              </div>
            )}
            {chatOpen && (
              <SelfPIP cameraOn={cameraOn} videoRef={videoRef} isSpeaking={youSpeaking} haloRef={selfHaloRef} positionClass="md:hidden absolute bottom-4 right-3 z-10" />
            )}

            {/* Desktop: SelfPIP absolute bottom-right, prompt card top-right */}
            <SelfPIP cameraOn={cameraOn} videoRef={videoRef} isSpeaking={youSpeaking} haloRef={selfHaloRef} positionClass="hidden md:block absolute bottom-4 right-3 z-10" />
            {!chatOpen && (
              <div className="hidden md:block absolute top-16 right-3 w-[300px] z-10">
                {promptCard}
              </div>
            )}
          </div>

        </div>

        {/* ── Right panel — shown only when chat is open ── */}
        <div className={`${chatOpen ? 'flex' : 'hidden'} flex-1 flex-col min-h-0 w-full md:flex-none md:flex-initial md:w-[320px] bg-white border-l border-neutral-200`}>

          {/* Prompt card section */}
          <div className="shrink-0 p-3 border-b border-neutral-200">
            {promptCard}
          </div>

          {/* Messages — scrollable */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0">
            {messages.length === 0 ? (
              <p className="text-xs text-neutral-400 text-center mt-4 leading-relaxed">
                Type while you talk — notes, words,<br />anything that helps.
              </p>
            ) : messages.map((m, i) => (
              <div key={i} className="flex justify-end">
                <span className="bg-[#2B8FFF]/10 border border-[#2B8FFF]/20 text-neutral-800 text-sm px-3 py-1.5 rounded-xl max-w-[85%]">
                  {m}
                </span>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 px-3 py-3 border-t border-neutral-200">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={message}
                onChange={e => setMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Type a message…"
                className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-[#2B8FFF] transition-colors"
              />
              <button
                onClick={handleSend}
                disabled={!message.trim()}
                className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 disabled:opacity-30 text-sm font-semibold text-neutral-700 rounded-xl transition-colors shrink-0"
              >
                Send
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* ── Control bar ── */}
      <div className="shrink-0 px-6 py-4 flex items-center justify-center gap-3 bg-white border-t border-neutral-200 z-10">
        <button
          onClick={() => setMuted(m => !m)}
          className={`flex flex-col items-center gap-1.5 w-14 py-2.5 rounded-xl transition-all ${
            muted ? 'bg-red-500 text-white' : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
          }`}
        >
          {muted
            ? <MicOff className="w-5 h-5" />
            : <Mic className="w-5 h-5" />
          }
          <span className="text-[11px] font-medium">{muted ? 'Unmute' : 'Mute'}</span>
        </button>

        <button
          onClick={() => setChatOpen(c => !c)}
          className={`flex flex-col items-center gap-1.5 w-14 py-2.5 rounded-xl transition-all ${
            chatOpen ? 'bg-[#2B8FFF] text-white' : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-[11px] font-medium">Chat</span>
        </button>

        <button
          onClick={() => setCameraOn(c => !c)}
          className={`flex flex-col items-center gap-1.5 w-14 py-2.5 rounded-xl transition-all ${
            cameraOn ? 'bg-[#2B8FFF] text-white' : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
          }`}
        >
          {cameraOn
            ? <Video className="w-5 h-5" />
            : <VideoOff className="w-5 h-5" />
          }
          <span className="text-[11px] font-medium">Camera</span>
        </button>

        <button
          onClick={() => setShowEndConfirm(true)}
          className="flex flex-col items-center gap-1.5 w-14 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-all"
        >
          <PhoneOff className="w-5 h-5" />
          <span className="text-[11px] font-medium">End</span>
        </button>
      </div>

      {/* ── End confirmation modal ── */}
      {showEndConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center px-6 z-50">
          <div className="bg-white rounded-2xl p-7 max-w-sm w-full text-center space-y-4 shadow-xl">
            <p className="text-xl font-bold text-neutral-900">End session?</p>
            <p className="text-sm text-neutral-500">You're doing great 🔥 — every minute counts.</p>
            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={handleEnd}
                className="w-full py-3 btn-primary text-white font-bold rounded-xl"
              >
                End session
              </button>
              <button
                onClick={() => setShowEndConfirm(false)}
                className="w-full py-3 text-sm text-neutral-400 hover:text-neutral-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 15-min checkpoint modal ── */}
      {checkpoint && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-6 z-50">
          <div className="bg-white border border-stone-200 rounded-2xl p-8 max-w-sm w-full text-center space-y-5 shadow-xl">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-widest text-stone-400">15 minutes</p>
              <p className="font-bold text-lg text-neutral-900 leading-snug">
                You&rsquo;ve been talking for 15 minutes.
              </p>
              <p className="text-sm text-stone-500">Keep going or wrap up?</p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setCheckpoint(false)}
                className="w-full py-3 btn-primary text-white font-bold rounded-xl"
              >
                Keep going
              </button>
              <button
                onClick={() => setShowEndConfirm(true)}
                className="w-full py-3 border border-stone-200 text-stone-500 font-medium rounded-xl hover:bg-stone-50 transition-colors"
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
