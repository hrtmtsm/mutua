'use client';

import { useState } from 'react';

// Static preview of what a banned user sees — no auth required
export default function BanPreviewPage() {
  const [showForm, setShowForm] = useState(false);
  const [claimed,  setClaimed]  = useState(false);
  const [note,     setNote]     = useState('');

  const until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center max-w-sm mx-auto">
      <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mb-5">
        <span className="text-2xl">🚫</span>
      </div>

      <h1 className="font-serif font-black text-2xl text-neutral-900 mb-2">
        Account suspended
      </h1>
      <p className="text-sm text-stone-500 mb-4 leading-relaxed">
        Your account is temporarily suspended until <strong className="text-neutral-800">{until}</strong>.
      </p>

      <div className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 mb-6 text-left">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400 mb-1">Message we saw</p>
        <p className="text-sm text-neutral-700 leading-relaxed italic">
          "Could you give me your Instagram account I can't figure out how to connect for a second conversation"
        </p>
      </div>

      <p className="text-xs text-stone-400 leading-relaxed mb-6">
        Mutua is a language-learning space. Sharing external contact info like Instagram or Snapchat
        isn't allowed to keep our community safe.
      </p>

      {claimed ? (
        <div className="w-full bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 text-center">
          <p className="text-sm font-semibold text-emerald-700">Appeal submitted</p>
          <p className="text-xs text-emerald-600 mt-0.5">We'll review it and get back to you.</p>
        </div>
      ) : showForm ? (
        <div className="w-full space-y-3">
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Anything you'd like us to know…"
            rows={3}
            className="w-full text-sm border border-stone-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-stone-200 resize-none text-neutral-800 placeholder-stone-300"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="flex-1 py-2.5 text-sm border border-stone-200 text-stone-500 rounded-xl"
            >
              Cancel
            </button>
            <button
              onClick={() => { setClaimed(true); setShowForm(false); }}
              className="flex-1 py-2.5 text-sm bg-neutral-900 text-white font-semibold rounded-xl"
            >
              Submit appeal
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="text-sm text-[#2B8FFF] underline"
        >
          This was a mistake — claim
        </button>
      )}

      <p className="text-[10px] text-stone-300 mt-10">Preview only — not a real ban</p>
    </div>
  );
}
