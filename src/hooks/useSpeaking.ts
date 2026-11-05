'use client';
import { useEffect, useState } from 'react';

/** True while `stream`'s audio level is above a quiet-room threshold — a lightweight
 *  active-speaker signal for UI highlighting, not a precise VAD. */
export function useSpeaking(stream: MediaStream | null, threshold = 14) {
 const [speaking, setSpeaking] = useState(false);
 useEffect(() => {
  if (!stream || stream.getAudioTracks().length === 0) { setSpeaking(false); return; }
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  const ctx = new Ctor();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.6;
  source.connect(analyser);
  const data = new Uint8Array(analyser.frequencyBinCount);
  const id = setInterval(() => {
   analyser.getByteFrequencyData(data);
   let sum = 0; for (let i = 0; i < data.length; i++) sum += data[i];
   setSpeaking(sum / data.length > threshold);
  }, 150);
  return () => { clearInterval(id); setSpeaking(false); source.disconnect(); analyser.disconnect(); void ctx.close(); };
 }, [stream, threshold]);
 return speaking;
}
