'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { liveAction } from '@/lib/liveExchange';
import { useLocale } from '@/components/LocaleProvider';

interface Options { callId?: string; conversationId?: string; myId?: string; partnerId?: string; muted: boolean; onFailure: (reason: string) => void }
export function useLiveAudio({ callId, conversationId, myId, partnerId, muted, onFailure }: Options) {
 const { t } = useLocale();
 const [state, setState] = useState<'idle'|'connecting'|'connected'|'failed'>('idle');
 const [stats, setStats] = useState({ sentBytes: 0, receivedBytes: 0, receivedEnergy: 0 });
 const [local, setLocal] = useState<MediaStream|null>(null);
 const [remote, setRemote] = useState<MediaStream|null>(null);
 const streamRef = useRef<MediaStream|null>(null);
 const failureRef = useRef(onFailure); failureRef.current = onFailure;
 const mutedRef = useRef(muted); mutedRef.current = muted;
 useEffect(() => { streamRef.current?.getAudioTracks().forEach(track => { track.enabled = !muted; }); }, [muted]);
 useEffect(() => {
  setRemote(null); setStats({ sentBytes: 0, receivedBytes: 0, receivedEnergy: 0 });
  if (!callId || !conversationId || !myId || !partnerId) { setState('idle'); return; }
  let stopped = false, failed = false, busy = false, offered = false;
  let cursor = 0;
  let phase: 'microphone'|'ice'|'signaling' = 'microphone';
  let poll: ReturnType<typeof setInterval>|undefined;
  let ready: ReturnType<typeof setInterval>|undefined;
  let deadline: ReturnType<typeof setTimeout>|undefined;
  let disconnected: ReturnType<typeof setTimeout>|undefined;
  let pc: RTCPeerConnection|undefined;
  let statsTimer: ReturnType<typeof setInterval>|undefined;
  const pendingIce: RTCIceCandidateInit[] = [];
  const caller = myId < partnerId;
  const fail = (reason: string) => {
   if (stopped || failed) return;
   failed = true;
   streamRef.current?.getTracks().forEach(track => track.stop());
   pc?.close(); setState('failed'); failureRef.current(reason);
  };
  const send = async (event: string, payload: Record<string, unknown> = {}) => {
   if (stopped || failed) return;
   await liveAction('signal', { conversationId, callId, event, payload });
  };
  const flushIce = async () => {
   if (!pc?.remoteDescription) return;
   while (pendingIce.length) await pc.addIceCandidate(pendingIce.shift()!);
  };
  const handle = async (event: string, payload: Record<string, any>) => {
   if (stopped || failed || !pc) return;
   if (event === 'ready' && caller && !offered) {
    offered = true;
    await pc.setLocalDescription(await pc.createOffer());
    if (stopped) return;
    await send('offer', { sdp: pc.localDescription?.toJSON() });
   } else if (event === 'offer' && !caller && pc.signalingState === 'stable') {
    await pc.setRemoteDescription(payload.sdp);
    await flushIce();
    await pc.setLocalDescription(await pc.createAnswer());
    if (stopped) return;
    await send('answer', { sdp: pc.localDescription?.toJSON() });
   } else if (event === 'answer' && caller && pc.signalingState === 'have-local-offer') {
    await pc.setRemoteDescription(payload.sdp); await flushIce();
   } else if (event === 'ice') {
    if (pc.remoteDescription) await pc.addIceCandidate(payload.candidate);
    else pendingIce.push(payload.candidate);
   }
  };
  const receive = async () => {
   if (busy || stopped || failed) return;
   busy = true;
   try {
    const { data, error } = await supabase.from('live_signals').select('id,sender_id,event,payload')
     .eq('call_id', callId).gt('id', cursor).order('id').limit(100);
    if (error) throw error;
    for (const signal of data || []) {
     if (stopped) return;
     if (signal.sender_id === partnerId) await handle(signal.event, signal.payload);
     cursor = signal.id;
    }
   } catch (error) { fail(error instanceof Error ? error.message : t('liveAudio.signalingFailed')); }
   finally { busy = false; }
  };
  setState('connecting');
  deadline = setTimeout(() => fail(phase === 'microphone' ? t('liveAudio.micPermissionTimeout') : t('liveAudio.audioConnectTimeout')), 25000);
  (async () => {
   try {
    // Permission failure is a real failure. Never substitute an empty stream.
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    if (stopped || failed) { stream.getTracks().forEach(track => track.stop()); return; }
    streamRef.current = stream; setLocal(stream);
    stream.getAudioTracks().forEach(track => { track.enabled = !mutedRef.current; });
    phase = 'ice';
    const response = await fetch('/api/ice-servers', { signal: AbortSignal.timeout(10000), headers:{Authorization:`Bearer ${(await supabase.auth.getSession()).data.session?.access_token||''}`} });
    if (!response.ok) throw new Error(t('liveAudio.iceServersFailed'));
    const iceServers: RTCIceServer[] = await response.json();
    if (stopped || failed) return;
    phase = 'signaling';
    pc = new RTCPeerConnection({ iceServers });
    stream.getTracks().forEach(track => pc!.addTrack(track, stream));
    statsTimer = setInterval(async () => {
      if (stopped || !pc) return;
      const report = await pc.getStats().catch(() => null);
      let sentBytes = 0, receivedBytes = 0, receivedEnergy = 0;
      report?.forEach(row => {
        if (row.type === 'outbound-rtp' && row.kind === 'audio') sentBytes += row.bytesSent || 0;
        if (row.type === 'inbound-rtp' && row.kind === 'audio') { receivedBytes += row.bytesReceived || 0; receivedEnergy += row.totalAudioEnergy || 0; }
      });
      if (!stopped) setStats({ sentBytes, receivedBytes, receivedEnergy });
    }, 1000);
    pc.onicecandidate = event => {
     if (event.candidate) send('ice', { candidate: event.candidate.toJSON() }).catch(() => fail(t('liveAudio.iceSendFailed')));
    };
    pc.ontrack = event => { if (!stopped) setRemote(event.streams[0] || new MediaStream([event.track])); };
    pc.onconnectionstatechange = () => {
     if (stopped || failed || !pc) return;
     if (pc.connectionState === 'connected') {
      clearTimeout(deadline); clearTimeout(disconnected); clearInterval(ready); setState('connected');
     } else if (pc.connectionState === 'failed') fail(t('liveAudio.audioConnectionFailed'));
     else if (pc.connectionState === 'disconnected') {
      clearTimeout(disconnected); disconnected = setTimeout(() => fail(t('liveAudio.audioDisconnected')), 8000);
     }
    };
    await send('ready');
    if (stopped || failed) return;
    ready = setInterval(() => { send('ready').catch(() => fail(t('liveAudio.audioKeepAliveFailed'))); }, 1500);
    poll = setInterval(receive, 400);
    await receive();
   } catch (error) {
    fail(error instanceof DOMException && error.name === 'NotAllowedError'
     ? t('liveAudio.micDenied')
     : error instanceof Error ? error.message : t('liveAudio.micStartFailed'));
   }
  })();
  return () => {
   stopped = true;
   clearInterval(poll); clearInterval(ready); clearInterval(statsTimer); clearTimeout(deadline); clearTimeout(disconnected);
   pc?.close(); streamRef.current?.getTracks().forEach(track => track.stop()); streamRef.current = null;
   setRemote(null); setLocal(null);
  };
 }, [callId, conversationId, myId, partnerId]);
 return { state, remote, stats, local };
}
