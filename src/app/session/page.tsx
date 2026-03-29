'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { MatchResult } from '@/lib/types';
import { LANG_FLAGS, LANG_AVATAR_COLOR } from '@/lib/constants';
import { Check, Mic, MicOff, MessageSquare, Video, VideoOff, PhoneOff, Wifi, WifiOff } from 'lucide-react';
import { useWebRTC } from '@/hooks/useWebRTC';
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

const CHECKPOINT = 10 * 60;

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
  initials, isSpeaking, avatarUrl, isMuted, videoRef, cameraOn,
}: {
  initials:  string;
  isSpeaking: boolean;
  avatarUrl?: string;
  isMuted?:  boolean;
  videoRef?: React.RefObject<HTMLVideoElement>;
  cameraOn?: boolean;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-[#2B8FFF]">

      {/* ── Partner live video (always mounted so srcObject and audio work even when camera off) ── */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`absolute inset-0 w-full h-full object-cover ${cameraOn ? '' : 'hidden'}`}
      />

      {/* ── Background + avatar (shown when camera off) ── */}
      {!cameraOn && (
        <>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover"
              style={{ filter: 'blur(28px) saturate(1.5) brightness(0.8)', transform: 'scale(1.1)' }}
            />
          ) : (
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
          {/* Foreground avatar */}
          <div className={`
            relative w-28 h-28 rounded-full
            bg-white/20 backdrop-blur-md ring-2 ring-white/40
            flex items-center justify-center font-black text-white text-3xl select-none
            transition-transform duration-200 ${isSpeaking ? 'scale-110' : ''}
          `}>
            {initials}
          </div>
        </>
      )}

      {/* Mute badge */}
      {isMuted && (
        <div className="absolute bottom-4 left-4 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-full px-2.5 py-1">
          <MicOff className="w-3.5 h-3.5 text-white" />
          <span className="text-[11px] font-semibold text-white">Muted</span>
        </div>
      )}
    </div>
  );
}

// ── SelfPIP ───────────────────────────────────────────────────────────────────

function SelfPIP({
  cameraOn, videoRef, isSpeaking, haloRef, positionClass, avatarUrl, initials, avatarBg,
}: {
  cameraOn:  boolean;
  videoRef:  React.RefObject<HTMLVideoElement>;
  isSpeaking: boolean;
  haloRef:   React.RefObject<HTMLDivElement>;
  positionClass?: string;
  avatarUrl?: string | null;
  initials?: string;
  avatarBg?: string;
}) {
  const bg = avatarBg ?? '#2B8FFF';
  return (
    <div
      className={`${positionClass ?? 'absolute bottom-4 right-3 z-10'} w-[180px] rounded-2xl overflow-hidden`}
      style={{ aspectRatio: '3/4' }}
    >
      {/* Always mounted so srcObject assignment persists across camera toggles */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={`absolute inset-0 w-full h-full object-cover ${cameraOn ? '' : 'hidden'}`}
      />

      {!cameraOn && (
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden" style={{ backgroundColor: bg }}>
          {/* Blurred profile background */}
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover"
              style={{ filter: 'blur(22px) saturate(1.5) brightness(0.8)', transform: 'scale(1.1)' }}
            />
          ) : (
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center"
              style={{ width: '200%', aspectRatio: '1', backgroundColor: bg, filter: 'blur(22px) saturate(1.5) brightness(0.82)' }}
            />
          )}
          {/* Speaking halo */}
          <div
            ref={haloRef}
            className="absolute w-16 h-16 rounded-full bg-white/30"
            style={{ opacity: 0, transform: 'scale(1)', transformOrigin: 'center', willChange: 'transform, opacity' }}
          />
          {/* Avatar circle — photo if available, else initials */}
          <div className="relative w-16 h-16 rounded-full overflow-hidden ring-2 ring-white/40 bg-white/20 backdrop-blur-md flex items-center justify-center font-bold text-white text-base select-none">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span>{initials ?? 'You'}</span>
            )}
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

  const [myId]            = useState(() => typeof window !== 'undefined' ? localStorage.getItem('mutua_session_id') ?? '' : '');
  const [showWalkthrough, setShowWalkthrough] = useState(() => typeof window !== 'undefined' ? !localStorage.getItem('mutua_seen_walkthrough') : false);
  const [myAvatarUrl,     setMyAvatarUrl]     = useState<string | null>(null);
  const [myInitials,      setMyInitials]      = useState('');
  const [myNativeLang,    setMyNativeLang]    = useState('');
  const [youSpeaking,     setYouSpeaking]     = useState(false);
  const [partnerSpeaking, setPartnerSpeaking] = useState(false);
  const [isOnline,        setIsOnline]        = useState(true);
  const [showEndConfirm,  setShowEndConfirm]  = useState(false);

  const videoRef           = useRef<HTMLVideoElement>(null);
  const partnerVideoRef    = useRef<HTMLVideoElement>(null);
  const audioCtxRef        = useRef<AudioContext | null>(null);
  const partnerAudioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef       = useRef<number>(0);
  const partnerAnimRef     = useRef<number>(0);
  const selfHaloRef        = useRef<HTMLDivElement>(null);
  const prevPhaseRef       = useRef<Phase>('ice');
  const messagesEndRef     = useRef<HTMLDivElement>(null);
  const promptChangedAtRef = useRef<number>(Date.now());

  const [pool, setPool] = useState<Pools>(() => buildFallbackPool(''));

  useEffect(() => {
    const rawProfile = localStorage.getItem('mutua_profile');
    if (rawProfile) {
      const p = JSON.parse(rawProfile);
      if (p.avatar_url) setMyAvatarUrl(p.avatar_url);
      if (p.native_language) setMyNativeLang(p.native_language);
      const name: string = p.name ?? '';
      const parts = name.trim().split(' ');
      setMyInitials(parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : name.slice(0, 2).toUpperCase());
    }
  }, []);

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
    const start = Date.now();
    const t = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      setSeconds(elapsed);
      if (elapsed >= CHECKPOINT) setCheckpoint(true);
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

  // ── WebRTC ─────────────────────────────────────────────────────────────────
  const { rtcState, localStream, partnerStream, partnerMuted, partnerCameraOn } = useWebRTC({
    myId,
    partnerId: match?.partner.session_id ?? '',
    muted,
    cameraOn,
  });

  // Wire local stream → SelfPIP video element
  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Wire partner stream → PartnerTile video element
  useEffect(() => {
    if (partnerVideoRef.current && partnerStream) {
      partnerVideoRef.current.srcObject = partnerStream;
    }
  }, [partnerStream, partnerCameraOn]);

  // ── Self speaking detection (from local stream audio track) ───────────────
  useEffect(() => {
    const audioTrack = localStream?.getAudioTracks()[0];
    if (!audioTrack || muted) {
      setYouSpeaking(false);
      if (selfHaloRef.current) { selfHaloRef.current.style.opacity = '0'; selfHaloRef.current.style.transform = 'scale(1)'; }
      cancelAnimationFrame(animFrameRef.current);
      audioCtxRef.current?.close();
      audioCtxRef.current = null;
      return;
    }

    const stream = new MediaStream([audioTrack]);
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      if (ctx.state === 'suspended') ctx.resume();
      analyser.getByteFrequencyData(buf);
      const rms = Math.sqrt(buf.reduce((s, v) => s + v * v, 0) / buf.length);
      const speaking = rms > 40;
      setYouSpeaking(speaking);
      if (selfHaloRef.current) {
        if (speaking) {
          const norm = Math.min(1, (rms - 40) / 70);
          selfHaloRef.current.style.opacity   = String(0.1 + norm * 0.3);
          selfHaloRef.current.style.transform = `scale(${1 + norm * 0.5})`;
        } else {
          selfHaloRef.current.style.opacity   = '0';
          selfHaloRef.current.style.transform = 'scale(1)';
        }
      }
      animFrameRef.current = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      audioCtxRef.current?.close();
      audioCtxRef.current = null;
      setYouSpeaking(false);
    };
  }, [localStream, muted]);

  // ── Partner speaking detection (from incoming stream) ─────────────────────
  useEffect(() => {
    const audioTrack = partnerStream?.getAudioTracks()[0];
    if (!audioTrack) { setPartnerSpeaking(false); return; }

    const stream = new MediaStream([audioTrack]);
    const ctx = new AudioContext();
    partnerAudioCtxRef.current = ctx;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      if (ctx.state === 'suspended') ctx.resume();
      analyser.getByteFrequencyData(buf);
      const rms = Math.sqrt(buf.reduce((s, v) => s + v * v, 0) / buf.length);
      setPartnerSpeaking(rms > 40);
      partnerAnimRef.current = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(partnerAnimRef.current);
      partnerAudioCtxRef.current?.close();
      partnerAudioCtxRef.current = null;
      setPartnerSpeaking(false);
    };
  }, [partnerStream]);

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
          <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 self-start mt-0.5 flex items-center justify-center"
            style={{ backgroundColor: LANG_AVATAR_COLOR[myNativeLang] ?? '#374151' }}>
            {myAvatarUrl ? (
              <img src={myAvatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[9px] font-black text-white leading-none">{myInitials || 'You'}</span>
            )}
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

      {/* ── RTC status banners ── */}
      {rtcState === 'connecting' && (
        <div className="shrink-0 bg-neutral-700 text-white text-xs font-medium text-center py-1.5 px-4 z-50 flex items-center justify-center gap-2">
          <Wifi className="w-3.5 h-3.5 animate-pulse" /> Connecting to partner…
        </div>
      )}
      {rtcState === 'disconnected' && (
        <div className="shrink-0 bg-amber-500 text-white text-xs font-medium text-center py-1.5 px-4 z-50 flex items-center justify-center gap-2">
          <WifiOff className="w-3.5 h-3.5" /> Partner disconnected — waiting to reconnect…
        </div>
      )}
      {rtcState === 'failed' && (
        <div className="shrink-0 bg-red-500 text-white text-xs font-medium text-center py-1.5 px-4 z-50 flex items-center justify-center gap-2">
          <WifiOff className="w-3.5 h-3.5" /> Connection failed — try ending and rejoining
        </div>
      )}

      {/* ── Content: participant area + right sidebar ── */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0">

        {/* ── Participant area: 50/50 split ── */}
        <div className={`relative flex flex-col md:flex-row ${chatOpen ? 'h-[38%] flex-none md:h-auto md:flex-1' : 'flex-1'}`}>

          {/* Partner pane */}
          <div className="relative flex-1 overflow-hidden">
            <PartnerTile
              initials={partnerName.trim().slice(0, 2).toUpperCase()}
              isSpeaking={partnerSpeaking}
              avatarUrl={partner.avatar_url}
              isMuted={partnerMuted}
              videoRef={partnerVideoRef}
              cameraOn={partnerCameraOn}
            />
            {/* Partner name bar */}
            <div className="absolute top-0 left-0 right-0 z-10 px-4 py-3 flex items-center justify-between"
              style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 100%)' }}>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-white text-sm leading-tight">{partnerName}</p>
                  {partnerMuted && (
                    <span className="flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5">
                      <MicOff className="w-3 h-3 text-white/80" />
                      <span className="text-[10px] font-semibold text-white/80">Muted</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-white mt-0.5">
                  {LANG_FLAGS[partner.native_language]} Native {partner.native_language}
                </p>
              </div>
              <span className="font-mono text-xs text-white/50 tabular-nums">{formatTime(seconds)}</span>
            </div>
          </div>

          {/* Prompt card — top-right over entire participant area */}
          {!chatOpen && (
            <div className="absolute top-14 right-3 w-[300px] z-20 hidden md:block">
              {promptCard}
            </div>
          )}

          {/* Self pane */}
          <div className="relative flex-1 overflow-hidden border-t border-white/10 md:border-t-0 md:border-l md:border-white/10">
            {/* Video always mounted */}
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={`absolute inset-0 w-full h-full object-cover ${cameraOn ? '' : 'hidden'}`}
            />
            {!cameraOn && (
              <div className="absolute inset-0 flex items-center justify-center overflow-hidden"
                style={{ backgroundColor: LANG_AVATAR_COLOR[myNativeLang] ?? '#2B8FFF' }}>
                {myAvatarUrl ? (
                  <img src={myAvatarUrl} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover"
                    style={{ filter: 'blur(28px) saturate(1.5) brightness(0.8)', transform: 'scale(1.1)' }} />
                ) : (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center"
                    style={{ width: '100vmax', height: '100vmax', backgroundColor: LANG_AVATAR_COLOR[myNativeLang] ?? '#2B8FFF', filter: 'blur(32px) saturate(1.5) brightness(0.82)' }} />
                )}
                <div ref={selfHaloRef} className="absolute w-24 h-24 rounded-full bg-white/30"
                  style={{ opacity: 0, transform: 'scale(1)', transformOrigin: 'center', willChange: 'transform, opacity' }} />
                <div className="relative w-20 h-20 rounded-full overflow-hidden ring-2 ring-white/40 bg-white/20 backdrop-blur-md flex items-center justify-center font-bold text-white text-xl select-none">
                  {myAvatarUrl ? <img src={myAvatarUrl} alt="" className="w-full h-full object-cover" /> : <span>{myInitials || 'You'}</span>}
                </div>
              </div>
            )}
            {/* "You" label */}
            <div className="absolute bottom-3 left-0 right-0 flex justify-center pointer-events-none z-10">
              <span className="text-[11px] font-semibold text-white/80 bg-black/25 backdrop-blur-sm px-2 py-0.5 rounded-full">You</span>
            </div>
            {/* Mobile prompt card */}
            {!chatOpen && (
              <div className="md:hidden absolute bottom-10 left-2 right-2 z-10">
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

      {/* ── First-session walkthrough tooltip ── */}
      {showWalkthrough && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          <div className="absolute inset-0 bg-black/40 pointer-events-auto"
            onClick={() => { localStorage.setItem('mutua_seen_walkthrough', 'true'); setShowWalkthrough(false); }}
          />

          {/* Desktop: below prompt card, top-right, arrow up */}
          <div className="hidden md:block absolute top-[340px] right-3 w-[260px] pointer-events-auto">
            <div className="flex justify-end pr-8">
              <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-b-[10px] border-l-transparent border-r-transparent border-b-white" />
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-xl space-y-3">
              <p className="text-sm font-semibold text-neutral-900">Conversation prompts</p>
              <p className="text-sm text-neutral-500 leading-relaxed">
                Use it as a guide — or just go with the flow.
              </p>
              <button
                onClick={() => { localStorage.setItem('mutua_seen_walkthrough', 'true'); setShowWalkthrough(false); }}
                className="w-full py-2.5 btn-primary text-white font-bold rounded-xl text-sm"
              >
                Got it 👍
              </button>
            </div>
          </div>

          {/* Mobile: above prompt card at bottom, arrow down */}
          <div className="md:hidden absolute bottom-[340px] left-3 right-3 pointer-events-auto">
            <div className="bg-white rounded-2xl p-4 shadow-xl space-y-3">
              <p className="text-sm font-semibold text-neutral-900">Conversation prompts</p>
              <p className="text-sm text-neutral-500 leading-relaxed">
                Use it as a guide — or just go with the flow.
              </p>
              <button
                onClick={() => { localStorage.setItem('mutua_seen_walkthrough', 'true'); setShowWalkthrough(false); }}
                className="w-full py-2.5 btn-primary text-white font-bold rounded-xl text-sm"
              >
                Got it 👍
              </button>
            </div>
            <div className="flex justify-center">
              <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-t-[10px] border-l-transparent border-r-transparent border-t-white" />
            </div>
          </div>
        </div>
      )}

      {/* ── End confirmation modal ── */}
      {showEndConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center px-6 z-50">
          <div className="bg-white rounded-2xl p-7 max-w-sm w-full text-center space-y-4 shadow-xl">
            <p className="text-xl font-bold text-neutral-900">End exchange?</p>
            <p className="text-sm text-neutral-500">You're doing great 🔥 — every minute counts.</p>
            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={handleEnd}
                className="w-full py-3 btn-primary text-white font-bold rounded-xl"
              >
                End exchange
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

      {/* ── 10-min balance nudge ── */}
      {checkpoint && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-6 z-50">
          <div className="bg-white border border-stone-200 rounded-2xl p-8 max-w-sm w-full text-center space-y-5 shadow-xl">
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-stone-400">10 minutes in</p>
              <p className="font-bold text-lg text-neutral-900 leading-snug">
                Make sure you&rsquo;re both getting equal practice time.
              </p>
              <p className="text-sm text-stone-500">
                Switch languages if you haven&rsquo;t already.
              </p>
            </div>
            <button
              onClick={() => setCheckpoint(false)}
              className="w-full py-3 btn-primary text-white font-bold rounded-xl"
            >
              Got it 👍
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
