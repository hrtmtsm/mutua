'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SavedPartner } from '@/lib/types';
import { LANG_FLAGS, LANG_AVATAR_COLOR } from '@/lib/constants';
import { getSessionStarters } from '@/lib/prompts';
import TopNav from '@/components/Sidebar';
import { Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { supabase, isConfigured } from '@/lib/supabase';

function Avatar({ name, lang, size = 'lg' }: { name: string; lang: string; size?: 'sm' | 'lg' }) {
  const bg = LANG_AVATAR_COLOR[lang] ?? '#3b82f6';
  const cls = size === 'lg' ? 'w-14 h-14 text-xl' : 'w-10 h-10 text-sm';
  return (
    <div style={{ backgroundColor: bg }} className={`${cls} rounded-2xl flex items-center justify-center font-black text-white shrink-0`}>
      {name.trim().slice(0, 2).toUpperCase()}
    </div>
  );
}

export default function PreSessionPage() {
  const router     = useRouter();
  const videoRef   = useRef<HTMLVideoElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);

  const [partner,        setPartner]        = useState<SavedPartner | null>(null);
  const [cameraOn,       setCameraOn]       = useState(false);
  const [micOn,          setMicOn]          = useState(false);
  const [audioDevices,    setAudioDevices]    = useState<MediaDeviceInfo[]>([]);
  const [audioDeviceId,   setAudioDeviceId]   = useState('');
  const [partnerOnline,   setPartnerOnline]   = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('mutua_current_partner');
    if (!stored) { router.replace('/'); return; }
    setPartner(JSON.parse(stored));
  }, [router]);

  // Enumerate audio input devices (requires a permission grant first)
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      const inputs = devices.filter(d =>
        d.kind === 'audioinput' && !d.label.toLowerCase().includes('virtual')
      );
      setAudioDevices(inputs);
      if (!audioDeviceId && inputs.length > 0) setAudioDeviceId(inputs[0].deviceId);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micOn]); // Re-enumerate after mic toggle so labels are populated

  // Poll for partner presence (sent as heartbeat from their session page)
  useEffect(() => {
    if (!isConfigured || !partner) return;
    const myId      = localStorage.getItem('mutua_session_id') ?? '';
    const partnerId = partner.partner_id;
    if (!myId || !partnerId) return;

    const check = async () => {
      const since = new Date(Date.now() - 30_000).toISOString();
      const { data } = await supabase
        .from('signaling')
        .select('id')
        .eq('event', 'presence')
        .eq('from_id', partnerId)
        .eq('to_id', myId)
        .gt('created_at', since)
        .limit(1);
      setPartnerOnline((data ?? []).length > 0);
    };

    check();
    const t = setInterval(check, 5000);
    return () => clearInterval(t);
  }, [partner]);

  useEffect(() => {
    if (cameraOn) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then(stream => {
          streamRef.current = stream;
          if (videoRef.current) videoRef.current.srcObject = stream;
        })
        .catch(() => setCameraOn(false));
    } else {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    }
  }, [cameraOn]);

  useEffect(() => {
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  if (!partner) return null;

  const flag = LANG_FLAGS[partner.native_language] ?? '';

  const handleStart = () => {
    const starters = getSessionStarters(partner.native_language);
    localStorage.setItem('mutua_match', JSON.stringify({
      partner: {
        session_id:         partner.partner_id,
        name:               partner.name,
        native_language:    partner.native_language,
        learning_language:  partner.learning_language,
        goal:               partner.goal,
        comm_style:         partner.comm_style,
        practice_frequency: partner.practice_frequency,
      },
      score: 0, reasons: [], starters,
      startWithCamera:   cameraOn,
      startWithMic:      micOn,
      audioDeviceId:     audioDeviceId || undefined,
    }));
    router.push('/session');
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <TopNav />

      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-3xl flex flex-col md:flex-row gap-8 items-center">

          {/* ── Left: video preview ── */}
          <div className="w-full md:flex-1 relative bg-neutral-800 rounded-2xl overflow-hidden aspect-video">

            {/* Video feed */}
            <video
              ref={videoRef}
              autoPlay muted playsInline
              className="absolute inset-0 w-full h-full object-cover"
              style={{ opacity: cameraOn ? 1 : 0, zIndex: 1 }}
            />

            {/* Avatar placeholder when camera off */}
            {!cameraOn && (
              <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 1 }}>
                <div className="w-16 h-16 rounded-2xl bg-neutral-700 flex items-center justify-center text-white font-black text-xl">
                  {partner.name.trim().slice(0, 2).toUpperCase()}
                </div>
              </div>
            )}

            {/* Name label */}
            <div className="absolute bottom-14 left-4" style={{ zIndex: 2 }}>
              <span className="text-sm font-semibold text-white drop-shadow">You</span>
            </div>

            {/* Controls */}
            <div
              className="absolute bottom-0 left-0 right-0 px-4 py-3 flex items-center justify-center gap-3 bg-gradient-to-t from-black/60 to-transparent"
              style={{ zIndex: 2 }}
            >
              {/* Mic */}
              <button
                onClick={() => setMicOn(m => !m)}
                title={micOn ? 'Mute' : 'Unmute'}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${micOn ? 'bg-white/20 hover:bg-white/30' : 'bg-red-500 hover:bg-red-600'}`}
              >
                {micOn
                  ? <Mic className="w-5 h-5 text-white" />
                  : <MicOff className="w-5 h-5 text-white" />
                }
              </button>

              {/* Camera */}
              <button
                onClick={() => setCameraOn(c => !c)}
                title={cameraOn ? 'Camera off' : 'Camera on'}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${cameraOn ? 'bg-white/20 hover:bg-white/30' : 'bg-red-500 hover:bg-red-600'}`}
              >
                {cameraOn
                  ? <Video className="w-5 h-5 text-white" />
                  : <VideoOff className="w-5 h-5 text-white" />
                }
              </button>

            </div>

            {/* Microphone selector */}
            {audioDevices.length > 1 && (
              <div className="absolute top-3 right-3 z-10">
                <select
                  value={audioDeviceId}
                  onChange={e => setAudioDeviceId(e.target.value)}
                  className="text-xs bg-black/60 text-white border border-white/20 rounded-lg px-2 py-1 backdrop-blur-sm max-w-[160px] truncate"
                >
                  {audioDevices.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Microphone ${d.deviceId.slice(0, 6)}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* ── Right: join panel ── */}
          <div className="w-full md:w-64 flex flex-col items-center text-center gap-5">
            <p className="font-serif font-black text-2xl text-neutral-900">Ready to join?</p>

            <div className="flex flex-col items-center gap-2">
              <Avatar name={partner.name} lang={partner.native_language} size="lg" />
              <p className="text-sm text-stone-500">
                <span className="font-semibold text-neutral-900">{partner.name}</span>
                {partnerOnline && (
                  <span className="ml-1.5 inline-flex items-center gap-1 text-emerald-600 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    is in this exchange
                  </span>
                )}
              </p>
              <p className="text-xs text-stone-400">{flag} Native {partner.native_language}</p>
            </div>

            <button
              onClick={handleStart}
              className="w-full py-3.5 btn-primary text-white font-bold text-base rounded-xl shadow-md"
            >
              Join now
            </button>
          </div>

        </div>
      </main>
    </div>
  );
}
