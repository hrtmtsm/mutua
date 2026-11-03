'use client';

// DEV-ONLY MOCK PROTOTYPE — not linked from production navigation.
// All data, timers, and outcomes below are fake. No DB writes, no API calls,
// no real WebRTC/AI connections. Purpose: validate the globe → pick/random →
// connect → call → end UX before any backend work begins.
//
// The real integration (mock + real API modes, SetupModal gating) lives at
// src/app/app/page.tsx. This page stays as a pure, zero-dependency UX sandbox.

import { useEffect, useRef, useState } from 'react';
import GlobeHero, { type GlobeMarker } from '@/components/GlobeHero';
import { LANG_FLAGS } from '@/lib/constants';
import { MOCK_USERS, AI_PARTNER, avatarColorFor, type MockUser } from '@/lib/mockPresence';
import { Starfield, Spinner, CenteredOverlay, ResolutionOverlay, PartnerAvatar } from '@/components/CallUiPrimitives';

type TargetScenario  = 'accept' | 'declined' | 'no_answer';
type RandomScenario  = 'match' | 'none';

type Stage =
  | 'globe'
  | 'ringing_out'
  | 'resolved_declined'
  | 'resolved_no_answer'
  | 'connecting_random'
  | 'resolved_no_one'
  | 'in_call'
  | 'ended';

export default function GlobePrototypePage() {
  const [stage,        setStage]        = useState<Stage>('globe');
  const [selectedUser,  setSelectedUser] = useState<MockUser | null>(null);
  const [callPartner,   setCallPartner]  = useState<MockUser | null>(null);
  const [isAiCall,      setIsAiCall]     = useState(false);
  const [muted,         setMuted]        = useState(false);
  const [elapsedSec,    setElapsedSec]   = useState(0);
  const [noAnswerCount, setNoAnswerCount] = useState(6);

  const [targetScenario, setTargetScenario] = useState<TargetScenario>('accept');
  const [randomScenario, setRandomScenario] = useState<RandomScenario>('match');

  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = () => {
    if (timerRef.current)    clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    timerRef.current = null;
    intervalRef.current = null;
  };

  useEffect(() => () => { clearTimers(); if (tickRef.current) clearInterval(tickRef.current); }, []);

  const markers: GlobeMarker[] = MOCK_USERS.map(u => ({
    id:          u.id,
    lat:         u.lat,
    lon:         u.lon,
    flag:        u.countryFlag,
    label:       u.name,
    initial:     u.name.slice(0, 1),
    avatarColor: avatarColorFor(u.nativeLanguage),
  }));

  function openProfile(markerId: string) {
    const user = MOCK_USERS.find(u => u.id === markerId);
    if (user) setSelectedUser(user);
  }

  function startRing(user: MockUser) {
    setSelectedUser(null);
    setCallPartner(user);
    setIsAiCall(false);
    setStage('ringing_out');
    clearTimers();

    if (targetScenario === 'accept') {
      timerRef.current = setTimeout(() => startCall(), 2000);
    } else if (targetScenario === 'declined') {
      timerRef.current = setTimeout(() => setStage('resolved_declined'), 2000);
    } else {
      // no_answer — visible countdown so the dev scenario is easy to verify live
      setNoAnswerCount(6);
      intervalRef.current = setInterval(() => {
        setNoAnswerCount(c => {
          if (c <= 1) {
            clearTimers();
            setStage('resolved_no_answer');
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    }
  }

  function cancelRing() {
    clearTimers();
    setCallPartner(null);
    setStage('globe');
  }

  function startRandom() {
    setSelectedUser(null);
    setStage('connecting_random');
    clearTimers();

    if (randomScenario === 'match') {
      timerRef.current = setTimeout(() => {
        setCallPartner(MOCK_USERS[0]);
        setIsAiCall(false);
        startCall();
      }, 2500);
    } else {
      timerRef.current = setTimeout(() => setStage('resolved_no_one'), 4000);
    }
  }

  function cancelRandom() {
    clearTimers();
    setStage('globe');
  }

  function startAiCallDirect() {
    setSelectedUser(null);
    setCallPartner(null);
    setIsAiCall(true);
    startCall();
  }

  function startCall() {
    clearTimers();
    setElapsedSec(0);
    setStage('in_call');
    tickRef.current = setInterval(() => setElapsedSec(s => s + 1), 1000);
  }

  function endCall() {
    if (tickRef.current) clearInterval(tickRef.current);
    setStage('ended');
  }

  function backToGlobe() {
    setCallPartner(null);
    setIsAiCall(false);
    setStage('globe');
  }

  const mm = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
  const ss = String(elapsedSec % 60).padStart(2, '0');

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[radial-gradient(ellipse_at_50%_30%,#0b1b33_0%,#040a17_60%,#02050d_100%)] text-white">
      <Starfield />

      {/* Persistent mock banner */}
      <div className="absolute top-0 inset-x-0 z-50 flex items-center justify-center py-1.5 bg-amber-500/90 text-[11px] font-semibold tracking-wide text-black">
        ⚠ モックデータ — 開発用プロトタイプ(DB・API・実通話には接続していません)
      </div>

      {/* Dev scenario panel */}
      <div className="absolute top-9 right-3 z-50 w-60 rounded-xl bg-black/60 border border-white/10 backdrop-blur px-3 py-3 text-xs space-y-3">
        <p className="font-semibold text-white/80">開発用シナリオ切り替え</p>

        <div className="space-y-1">
          <p className="text-white/50">相手を選ぶ(話してみる)</p>
          <select
            value={targetScenario}
            onChange={e => setTargetScenario(e.target.value as TargetScenario)}
            className="w-full rounded bg-white/10 px-2 py-1 text-white"
          >
            <option value="accept">応答あり(成功)</option>
            <option value="declined">相手が拒否</option>
            <option value="no_answer">応答なし(タイムアウト)</option>
          </select>
        </div>

        <div className="space-y-1">
          <p className="text-white/50">今すぐ話す</p>
          <select
            value={randomScenario}
            onChange={e => setRandomScenario(e.target.value as RandomScenario)}
            className="w-full rounded bg-white/10 px-2 py-1 text-white"
          >
            <option value="match">相手が見つかる</option>
            <option value="none">誰もいない→AI提案</option>
          </select>
        </div>

        <button
          onClick={startAiCallDirect}
          className="w-full rounded bg-indigo-500/80 hover:bg-indigo-500 py-1.5 font-semibold"
        >
          AI通話を直接開く
        </button>
      </div>

      {/* ── Globe stage ───────────────────────────────────────────────── */}
      {stage === 'globe' && (
        <>
          <div className="absolute inset-0">
            <GlobeHero markers={markers} interactive theme="night" onMarkerClick={openProfile} />
          </div>

          <div className="absolute bottom-8 inset-x-0 flex justify-center z-40">
            <button
              onClick={startRandom}
              className="px-6 py-3 rounded-full bg-white text-black font-semibold shadow-xl hover:scale-105 transition-transform"
            >
              今すぐ話す
            </button>
          </div>

          {selectedUser && (
            <ProfileSheet
              user={selectedUser}
              onClose={() => setSelectedUser(null)}
              onCall={() => startRing(selectedUser)}
            />
          )}
        </>
      )}

      {/* ── Ringing (targeted) ───────────────────────────────────────── */}
      {stage === 'ringing_out' && callPartner && (
        <CenteredOverlay>
          <PartnerAvatar name={callPartner.name} color={avatarColorFor(callPartner.nativeLanguage)} flag={callPartner.countryFlag} size={88} />
          <p className="mt-4 text-lg font-semibold">{callPartner.name} を呼び出し中…</p>
          {targetScenario === 'no_answer' && (
            <p className="mt-1 text-white/50 text-sm">応答がない場合、あと{noAnswerCount}秒で終了します</p>
          )}
          <button onClick={cancelRing} className="mt-8 px-5 py-2 rounded-full bg-white/10 hover:bg-white/20">
            キャンセル
          </button>
        </CenteredOverlay>
      )}

      {/* ── Targeted call resolutions ────────────────────────────────── */}
      {stage === 'resolved_declined' && (
        <ResolutionOverlay
          title="今は応じられませんでした"
          actions={[{ label: '地球儀へ戻る', onClick: backToGlobe, primary: true }]}
        />
      )}
      {stage === 'resolved_no_answer' && (
        <ResolutionOverlay
          title="応答がありませんでした"
          actions={[
            { label: '他の人を探す', onClick: backToGlobe },
            { label: '今すぐ話す', onClick: startRandom },
            { label: 'AIパートナーと話す', onClick: startAiCallDirect, primary: true },
          ]}
        />
      )}

      {/* ── Random connecting ─────────────────────────────────────────── */}
      {stage === 'connecting_random' && (
        <CenteredOverlay>
          <Spinner />
          <p className="mt-4 text-lg font-semibold">つながる相手を探しています…</p>
          <p className="mt-1 text-white/50 text-sm">言語条件の合う相手を探しています</p>
          <button onClick={cancelRandom} className="mt-8 px-5 py-2 rounded-full bg-white/10 hover:bg-white/20">
            キャンセル
          </button>
        </CenteredOverlay>
      )}
      {stage === 'resolved_no_one' && (
        <ResolutionOverlay
          title="今は話せる相手が見つかりませんでした"
          actions={[
            { label: '地球儀へ戻る', onClick: backToGlobe },
            { label: 'AIパートナーと話す', onClick: startAiCallDirect, primary: true },
          ]}
        />
      )}

      {/* ── In call ───────────────────────────────────────────────────── */}
      {stage === 'in_call' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {isAiCall && (
            <span className="absolute top-14 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-indigo-500/90 text-xs font-semibold tracking-wide">
              AI パートナーと話しています
            </span>
          )}

          <PartnerAvatar
            name={isAiCall ? AI_PARTNER.name : callPartner?.name ?? '相手'}
            color={isAiCall ? AI_PARTNER.avatarColor : avatarColorFor(callPartner?.nativeLanguage ?? '')}
            flag={isAiCall ? undefined : callPartner?.countryFlag}
            size={120}
          />

          <p className="mt-5 text-xl font-semibold flex items-center gap-2">
            {isAiCall ? AI_PARTNER.name : callPartner?.name}
            {isAiCall && <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-500/70 font-semibold">AI</span>}
          </p>
          {!isAiCall && callPartner && (
            <p className="text-white/50 text-sm mt-1">{callPartner.countryFlag} {callPartner.nativeLanguage}</p>
          )}
          <p className="text-white/40 text-sm mt-1 tabular-nums">{mm}:{ss}</p>

          <div className="absolute bottom-10 flex items-center gap-4">
            <button
              onClick={() => setMuted(m => !m)}
              className={`w-14 h-14 rounded-full flex items-center justify-center text-xl ${muted ? 'bg-white text-black' : 'bg-white/10 hover:bg-white/20'}`}
              aria-pressed={muted}
              aria-label="ミュート切替"
            >
              {muted ? '🔇' : '🎙️'}
            </button>
            <button
              onClick={endCall}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-2xl"
              aria-label="通話を終了"
            >
              ⏹
            </button>
          </div>
        </div>
      )}

      {/* ── Ended ─────────────────────────────────────────────────────── */}
      {stage === 'ended' && (
        <ResolutionOverlay
          title="通話を終了しました"
          subtitle={isAiCall ? undefined : `${callPartner?.name ?? ''}さんとの通話 ${mm}:${ss}`}
          actions={[
            { label: '終了する', onClick: backToGlobe },
            { label: '次の相手を探す', onClick: startRandom, primary: true },
          ]}
        />
      )}
    </div>
  );
}

function ProfileSheet({
  user, onClose, onCall,
}: { user: MockUser; onClose: () => void; onCall: () => void }) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-6">
      <div className="w-full max-w-sm rounded-2xl bg-[#0d1a2e]/95 border border-white/10 backdrop-blur-xl p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <PartnerAvatar name={user.name} color={avatarColorFor(user.nativeLanguage)} flag={user.countryFlag} size={56} />
          <div className="flex-1">
            <p className="font-semibold text-base">{user.name}</p>
            <p className="text-white/50 text-xs mt-0.5">
              {LANG_FLAGS[user.nativeLanguage] ?? user.countryFlag} {user.nativeLanguage} → {user.learningLanguage}
            </p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-sm px-2">✕</button>
        </div>

        <p className="text-sm text-white/70 mt-3 leading-relaxed">{user.bio}</p>

        {user.sharedInterests.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {user.sharedInterests.map(tag => (
              <span key={tag} className="text-[11px] px-2 py-1 rounded-full bg-white/10 text-white/70">
                共通: {tag}
              </span>
            ))}
          </div>
        )}

        <button
          onClick={onCall}
          className="mt-4 w-full py-2.5 rounded-full bg-white text-black font-semibold hover:scale-[1.02] transition-transform"
        >
          話してみる
        </button>
      </div>
    </div>
  );
}
