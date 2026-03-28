'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

// Free TURN relay — needed for cross-network connections (cellular ↔ WiFi).
// Replace with your own TURN server credentials in production.
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  {
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443',
      'turn:openrelay.metered.ca:443?transport=tcp',
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

export type RTCState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'failed';

interface Options {
  myId:      string;
  partnerId: string;
  muted:     boolean;
  cameraOn:  boolean;
}

// ── DB-based signaling (polling) ──────────────────────────────────────────────

async function dbSend(channel: string, fromId: string, toId: string, event: string, payload: Record<string, unknown>) {
  await supabase.from('signaling').insert({ channel, from_id: fromId, to_id: toId, event, payload });
}

async function dbPoll(channel: string, toId: string, since: string): Promise<Array<{ id: string; event: string; payload: any; from_id: string }>> {
  const { data } = await supabase
    .from('signaling')
    .select('id, event, payload, from_id')
    .eq('channel', channel)
    .eq('to_id', toId)
    .gt('created_at', since)
    .order('created_at', { ascending: true });
  return data ?? [];
}

async function dbDelete(ids: string[]) {
  if (ids.length === 0) return;
  await supabase.from('signaling').delete().in('id', ids);
}

export function useWebRTC({ myId, partnerId, muted, cameraOn }: Options) {
  const [rtcState,       setRtcState]       = useState<RTCState>('idle');
  const [localStream,    setLocalStream]    = useState<MediaStream | null>(null);
  const [partnerStream,  setPartnerStream]  = useState<MediaStream | null>(null);
  const [partnerMuted,   setPartnerMuted]   = useState(false);
  const [partnerCamOn,   setPartnerCamOn]   = useState(false);

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

  const isCaller    = myId < partnerId;
  const channelName = `rtc:${[myId, partnerId].sort().join(':')}`;

  // ── helpers ────────────────────────────────────────────────────────────────

  const send = useCallback((event: string, payload: Record<string, unknown> = {}) => {
    dbSend(channelName, myId, partnerId, event, payload).catch(() => {});
  }, [channelName, myId, partnerId]);

  const flushIce = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;
    for (const c of iceBuf.current) {
      try { await pc.addIceCandidate(c); } catch { /* stale */ }
    }
    iceBuf.current = [];
  }, []);

  const buildPC = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

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

    pcRef.current = pc;
    return pc;
  }, [send]);

  const addTracks = useCallback((pc: RTCPeerConnection) => {
    const stream = localStreamRef.current;
    if (stream) stream.getTracks().forEach(t => pc.addTrack(t, stream));
  }, []);

  // ── message handler ────────────────────────────────────────────────────────

  const handleMessage = useCallback(async (event: string, payload: any) => {
    if (event === 'ready') {
      partnerReady.current = true;
      if (isCaller) {
        if (readyTimer.current) { clearInterval(readyTimer.current); readyTimer.current = null; }
        if (!pcRef.current) {
          const pc = buildPC();
          addTracks(pc);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          send('offer', { sdp: offer });
        }
      }
      return;
    }

    if (event === 'offer' && !isCaller) {
      if (pcRef.current) return; // guard against duplicate offers
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
  }, [isCaller, buildPC, addTracks, send, flushIce]);

  // ── main effect: media + signaling ─────────────────────────────────────────
  // IMPORTANT: We start signaling only AFTER getUserMedia resolves so that
  // local tracks are always attached before the offer/answer exchange.

  useEffect(() => {
    if (!myId || !partnerId) return;
    setRtcState('connecting');
    sinceRef.current = new Date(Date.now() - 500).toISOString();

    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({ audio: true, video: true })
      .catch(() => navigator.mediaDevices.getUserMedia({ audio: true, video: false }))
      .catch(() => new MediaStream())
      .then(stream => {
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }

        localStreamRef.current = stream;
        stream.getAudioTracks().forEach(t => { t.enabled = !mutedRef.current; });
        stream.getVideoTracks().forEach(t => { t.enabled = cameraOnRef.current; });
        setLocalStream(stream);

        // Announce ready now that we have media
        send('ready');

        // Caller retries every 2s until partner responds
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

        // Poll for incoming messages every 600ms
        pollTimer.current = setInterval(async () => {
          const msgs = await dbPoll(channelName, myId, sinceRef.current);
          if (msgs.length === 0) return;

          sinceRef.current = new Date().toISOString();

          const ids: string[] = [];
          for (const msg of msgs) {
            if (msg.from_id !== partnerId) continue;
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
  }, [myId, partnerId]);

  // ── sync mute/camera → tracks + notify partner ─────────────────────────────

  useEffect(() => {
    mutedRef.current    = muted;
    cameraOnRef.current = cameraOn;
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !muted; });
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = cameraOn; });
    if (myId && partnerId) send('media', { muted, cameraOn });
  }, [muted, cameraOn, myId, partnerId, send]);

  return { rtcState, localStream, partnerStream, partnerMuted, partnerCameraOn: partnerCamOn };
}
