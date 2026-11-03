'use client';

// 即時通話(/app の実APIモード)用のWebRTCフック。既存の useWebRTC.ts
// (予約制レッスン用、signalingテーブル・mutua_session_id前提)と並行して存在する
// 別フック — 既存フックは無改変。異なる点:
//   - myId/partnerId は auth.uid() の実UUID(session_idではない)
//   - シグナリングは instant_signaling テーブル(channel列を持たず、
//     session_id = instant_sessions.id で区切る設計。RLSは
//     「自分がuser_a/user_bである instant_sessions の行のみ」を参照するため
//     from_user/to_user の偽装・他セッションの読み取りはDB側で拒否される)
//
// 本番DBに instant_signaling テーブルがまだ存在しないため、このフック自体は
// ローカルPostgresでのテーブル構造確認のみで、ブラウザ越しの実通話(2クライアント
// 間のオファー/アンサー交換)は未検証。

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const FALLBACK_ICE: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export type RTCState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'failed';

interface Options {
  myId:           string;
  partnerId:      string;
  sessionId:      string;
  muted:          boolean;
  cameraOn:       boolean;
  audioDeviceId?: string;
}

// ── DB-based signaling (polling, instant_signaling テーブル) ─────────────────

async function dbSend(sessionId: string, fromId: string, toId: string, event: string, payload: Record<string, unknown>) {
  const { error } = await supabase
    .from('instant_signaling')
    .insert({ session_id: sessionId, from_user: fromId, to_user: toId, event, payload });
  if (error) console.error('[instant-signal] send failed:', event, error.message, error.code);
}

async function dbPoll(sessionId: string, toId: string, since: string): Promise<Array<{ id: number; event: string; payload: any; from_user: string }>> {
  const { data } = await supabase
    .from('instant_signaling')
    .select('id, event, payload, from_user')
    .eq('session_id', sessionId)
    .eq('to_user', toId)
    .gt('created_at', since)
    .order('created_at', { ascending: true });
  return data ?? [];
}

async function dbDelete(ids: number[]) {
  if (ids.length === 0) return;
  await supabase.from('instant_signaling').delete().in('id', ids);
}

export function useInstantWebRTC({ myId, partnerId, sessionId, muted, cameraOn, audioDeviceId }: Options) {
  const [rtcState,       setRtcState]       = useState<RTCState>('idle');
  const [localStream,    setLocalStream]    = useState<MediaStream | null>(null);
  const [partnerStream,  setPartnerStream]  = useState<MediaStream | null>(null);
  const [partnerMuted,   setPartnerMuted]   = useState(false);
  const [partnerCamOn,   setPartnerCamOn]   = useState(false);

  const iceServersRef  = useRef<RTCIceServer[]>(FALLBACK_ICE);
  const pcRef          = useRef<RTCPeerConnection | null>(null);
  const iceBuf         = useRef<RTCIceCandidateInit[]>([]);
  const remoteSetRef   = useRef(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pollTimer      = useRef<ReturnType<typeof setInterval> | null>(null);
  const readyTimer     = useRef<ReturnType<typeof setInterval> | null>(null);
  const partnerReady   = useRef(false);
  const sinceRef       = useRef(new Date().toISOString());
  const mutedRef       = useRef(muted);
  const cameraOnRef    = useRef(cameraOn);

  const isCaller = myId < partnerId;

  // ── helpers ────────────────────────────────────────────────────────────────

  const send = useCallback((event: string, payload: Record<string, unknown> = {}) => {
    console.log('[instant-signal] →', event);
    dbSend(sessionId, myId, partnerId, event, payload).catch(e => console.error('[instant-signal] send error:', e));
  }, [sessionId, myId, partnerId]);

  const flushIce = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;
    for (const c of iceBuf.current) {
      try { await pc.addIceCandidate(c); } catch { /* stale */ }
    }
    iceBuf.current = [];
  }, []);

  const buildPC = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) send('ice', { candidate: candidate.toJSON() });
    };

    pc.ontrack = ({ streams }) => {
      if (streams[0]) setPartnerStream(streams[0]);
    };

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === 'connected')    setRtcState('connected');
      if (s === 'disconnected') setRtcState('disconnected');
      if (s === 'failed')       setRtcState('failed');
    };

    pc.oniceconnectionstatechange = () => {
      const s = pc.iceConnectionState;
      if (s === 'disconnected' || s === 'failed') setPartnerStream(null);
    };

    pcRef.current = pc;
    return pc;
  }, [send]);

  const addTracks = useCallback((pc: RTCPeerConnection) => {
    const stream = localStreamRef.current;
    if (stream) stream.getTracks().forEach(t => pc.addTrack(t, stream));
  }, []);

  const resetPC = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    remoteSetRef.current = false;
    iceBuf.current = [];
  }, []);

  // ── message handler ────────────────────────────────────────────────────────

  const handleMessage = useCallback(async (event: string, payload: any) => {
    if (event === 'ready') {
      partnerReady.current = true;
      if (isCaller) {
        if (readyTimer.current) { clearInterval(readyTimer.current); readyTimer.current = null; }
        const state = pcRef.current?.connectionState;
        const needsRestart = !pcRef.current || state === 'failed' || state === 'closed' || state === 'disconnected';
        if (needsRestart) {
          resetPC();
          const pc = buildPC();
          addTracks(pc);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          send('offer', { sdp: offer });
        }
      } else {
        send('ready');
      }
      return;
    }

    if (event === 'offer' && !isCaller) {
      const state = pcRef.current?.connectionState;
      const isStale = !pcRef.current || state === 'failed' || state === 'closed' || state === 'disconnected';
      if (!isStale) return;
      resetPC();
      const pc = buildPC();
      addTracks(pc);
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      remoteSetRef.current = true;
      await flushIce();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      send('answer', { sdp: answer });
      return;
    }

    if (event === 'answer' && isCaller) {
      const pc = pcRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      remoteSetRef.current = true;
      await flushIce();
      return;
    }

    if (event === 'ice') {
      if (remoteSetRef.current && pcRef.current) {
        try { await pcRef.current.addIceCandidate(payload.candidate); } catch { /* ignore */ }
      } else {
        iceBuf.current.push(payload.candidate);
      }
      return;
    }

    if (event === 'media') {
      setPartnerMuted(payload.muted as boolean);
      setPartnerCamOn(payload.cameraOn as boolean);
      return;
    }
  }, [isCaller, buildPC, addTracks, send, flushIce, resetPC]);

  // ── main effect: media + signaling ─────────────────────────────────────────
  // getUserMedia は通話ID(sessionId)確定後にこのフックがマウントされたときに
  // 初めて呼ばれる — 設定完了だけではマイク取得は起きない、という要件は
  // 呼び出し側(sessionId確定時だけこのフックを使う)で自然に満たされる。

  useEffect(() => {
    if (!myId || !partnerId || !sessionId) return;
    setRtcState('connecting');
    sinceRef.current = new Date(Date.now() - 500).toISOString();

    let cancelled = false;

    const audioConstraint: MediaTrackConstraints = audioDeviceId
      ? { deviceId: { exact: audioDeviceId } }
      : true as unknown as MediaTrackConstraints;

    const getMedia = () =>
      navigator.mediaDevices.getUserMedia({ audio: audioConstraint, video: true })
        .catch(() => navigator.mediaDevices.getUserMedia({ audio: audioConstraint, video: false }))
        .catch(() => navigator.mediaDevices.getUserMedia({ audio: true, video: false }))
        .catch(() => new MediaStream());

    const getIce = () =>
      fetch('/api/ice-servers').then(r => r.json()).catch(() => FALLBACK_ICE);

    Promise.all([getMedia(), getIce()]).then(([stream, iceServers]) => {
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }

        iceServersRef.current = iceServers;
        localStreamRef.current = stream;
        stream.getAudioTracks().forEach(t => { t.enabled = !mutedRef.current; });
        stream.getVideoTracks().forEach(t => { t.enabled = cameraOnRef.current; });
        setLocalStream(stream);

        send('ready');

        if (isCaller) {
          readyTimer.current = setInterval(() => {
            if (partnerReady.current) {
              clearInterval(readyTimer.current!);
              readyTimer.current = null;
            } else {
              send('ready');
            }
          }, 2000);
        }

        pollTimer.current = setInterval(async () => {
          const msgs = await dbPoll(sessionId, myId, sinceRef.current);
          if (msgs.length === 0) return;

          sinceRef.current = new Date().toISOString();

          const ids: number[] = [];
          for (const msg of msgs) {
            if (msg.from_user !== partnerId) continue;
            ids.push(msg.id);
            await handleMessage(msg.event, msg.payload);
          }
          dbDelete(ids).catch(() => {});
        }, 600);
      });

    return () => {
      cancelled = true;
      if (readyTimer.current)  clearInterval(readyTimer.current);
      if (pollTimer.current)   clearInterval(pollTimer.current);
      pcRef.current?.close();
      pcRef.current = null;
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
      remoteSetRef.current = false;
      iceBuf.current = [];
      partnerReady.current = false;
      setLocalStream(null);
      setPartnerStream(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId, partnerId, sessionId]);

  // ── sync mute/camera → tracks + notify partner ─────────────────────────────

  useEffect(() => {
    mutedRef.current    = muted;
    cameraOnRef.current = cameraOn;
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !muted; });
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = cameraOn; });
    if (myId && partnerId) send('media', { muted, cameraOn });
  }, [muted, cameraOn, myId, partnerId, send]);

  // ── switch camera or mic mid-session ───────────────────────────────────────

  const switchDevice = useCallback(async (kind: 'videoinput' | 'audioinput', deviceId: string) => {
    const stream = localStreamRef.current;
    if (!stream) return;
    try {
      const constraints = kind === 'videoinput'
        ? { video: { deviceId: { exact: deviceId } } }
        : { audio: { deviceId: { exact: deviceId } } };
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      const newTrack  = kind === 'videoinput'
        ? newStream.getVideoTracks()[0]
        : newStream.getAudioTracks()[0];
      if (!newTrack) return;

      const pc = pcRef.current;
      if (pc) {
        const sender = pc.getSenders().find(s => s.track?.kind === newTrack.kind);
        if (sender) await sender.replaceTrack(newTrack);
      }

      const old = kind === 'videoinput' ? stream.getVideoTracks() : stream.getAudioTracks();
      old.forEach(t => { stream.removeTrack(t); t.stop(); });
      newTrack.enabled = kind === 'videoinput' ? cameraOnRef.current : !mutedRef.current;
      stream.addTrack(newTrack);
      setLocalStream(new MediaStream(stream.getTracks()));
    } catch (e) {
      console.error('[instant-rtc] switchDevice failed:', e);
    }
  }, []);

  return { rtcState, localStream, partnerStream, partnerMuted, partnerCameraOn: partnerCamOn, send, switchDevice };
}
