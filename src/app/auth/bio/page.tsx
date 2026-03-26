'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const MAX = 150;

export default function BioPage() {
  const router = useRouter();
  const [bio,     setBio]     = useState('');
  const [loading, setLoading] = useState(false);

  const save = async () => {
    const text = bio.trim();
    if (!text) { router.replace('/find-match'); return; }

    setLoading(true);
    const sid = localStorage.getItem('mutua_session_id');
    if (sid) {
      await supabase.from('profiles').update({ bio: text }).eq('session_id', sid);
      const stored = localStorage.getItem('mutua_profile');
      if (stored) {
        localStorage.setItem('mutua_profile', JSON.stringify({ ...JSON.parse(stored), bio: text }));
      }
    }
    router.replace('/find-match');
  };

  const skip = () => router.replace('/find-match');

  return (
    <div className="min-h-screen flex flex-col bg-white">

      <nav className="px-8 py-5 shrink-0">
        <span className="font-serif font-black text-2xl tracking-tight text-neutral-900">mutua</span>
      </nav>

      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">

          <div className="mb-8">
            <h1 className="font-serif font-black text-neutral-900 leading-tight mb-2 text-3xl">
              Introduce yourself.
            </h1>
            <p className="text-sm text-stone-500">
              Your partner will see this. Tell them a bit about who you are.
            </p>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value.slice(0, MAX))}
                placeholder="e.g. I'm a software engineer from Tokyo. I love hiking and trying new coffee shops. Learning English to make more international friends."
                rows={5}
                autoFocus
                className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm text-neutral-900 placeholder:text-stone-300 focus:outline-none focus:border-neutral-400 transition-all resize-none leading-relaxed"
              />
              <span className="absolute bottom-3 right-3 text-xs text-stone-300">
                {bio.length}/{MAX}
              </span>
            </div>

            <button
              onClick={save}
              disabled={loading}
              className="w-full py-3.5 btn-primary text-white font-bold text-sm rounded-xl disabled:opacity-40 disabled:pointer-events-none"
            >
              {loading ? 'Saving...' : 'Continue →'}
            </button>

            <button
              onClick={skip}
              className="w-full py-2 text-sm text-stone-400 hover:text-neutral-700 transition-colors font-medium"
            >
              Skip for now
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
