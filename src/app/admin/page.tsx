'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

interface FlaggedMessage {
  id:             string;
  match_id:       string;
  sender_id:      string;
  text:           string;
  created_at:     string;
  sender_name:    string;
  sender_email:   string;
  banned_until:   string | null;
  ban_claimed_at: string | null;
}

const DURATIONS = [
  { label: '3 days',  days: 3  },
  { label: '7 days',  days: 7  },
  { label: '30 days', days: 30 },
];

function highlight(text: string): string {
  const keywords = ['instagram', 'insta', 'snapchat', 'whatsapp', 'telegram', 'discord', 'tiktok', 'twitter', 'facebook'];
  let out = text;
  for (const kw of keywords) {
    out = out.replace(new RegExp(`(${kw})`, 'gi'), '<mark class="bg-amber-200 rounded px-0.5">$1</mark>');
  }
  return out;
}

function isBanned(bannedUntil: string | null): boolean {
  if (!bannedUntil) return false;
  return new Date(bannedUntil) > new Date();
}

function AdminInner() {
  const searchParams = useSearchParams();
  const secret = searchParams.get('secret') ?? '';

  const [messages, setMessages]   = useState<FlaggedMessage[]>([]);
  const [loading,  setLoading]    = useState(true);
  const [error,    setError]      = useState('');

  // Ban modal state
  const [modal,    setModal]      = useState<FlaggedMessage | null>(null);
  const [duration, setDuration]   = useState(7);
  const [reason,   setReason]     = useState('');
  const [banning,  setBanning]    = useState(false);

  useEffect(() => {
    fetch(`/api/admin/flagged-messages?secret=${encodeURIComponent(secret)}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setMessages(d.messages ?? []);
      })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  }, [secret]);

  const openModal = (msg: FlaggedMessage) => {
    setModal(msg);
    setReason(msg.text);
    setDuration(7);
  };

  const handleBan = async () => {
    if (!modal) return;
    setBanning(true);
    const res = await fetch(`/api/admin/ban-user?secret=${encodeURIComponent(secret)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: modal.sender_id, reason, durationDays: duration }),
    });
    const data = await res.json();
    setBanning(false);
    if (data.ok) {
      setMessages(prev => prev.map(m =>
        m.sender_id === modal.sender_id
          ? { ...m, banned_until: data.banned_until }
          : m
      ));
      setModal(null);
    } else {
      alert('Error: ' + data.error);
    }
  };

  const handleLiftBan = async (sessionId: string) => {
    if (!confirm('Lift this ban?')) return;
    await fetch(`/api/admin/ban-user?secret=${encodeURIComponent(secret)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    setMessages(prev => prev.map(m =>
      m.sender_id === sessionId ? { ...m, banned_until: null, ban_claimed_at: null } : m
    ));
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen text-stone-400 text-sm">Loading...</div>;
  if (error === 'Unauthorized') return <div className="flex items-center justify-center min-h-screen text-rose-500 text-sm">Invalid secret.</div>;
  if (error) return <div className="flex items-center justify-center min-h-screen text-rose-500 text-sm">{error}</div>;

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="font-serif font-black text-2xl text-neutral-900 mb-1">Flagged messages</h1>
        <p className="text-sm text-stone-400 mb-6">{messages.length} message{messages.length !== 1 ? 's' : ''} flagged for external contact sharing</p>

        {messages.length === 0 && (
          <p className="text-center text-stone-400 py-20 text-sm">No flagged messages</p>
        )}

        <div className="space-y-3">
          {messages.map(msg => {
            const banned  = isBanned(msg.banned_until);
            const claimed = !!msg.ban_claimed_at;
            return (
              <div key={msg.id} className="bg-white rounded-2xl border border-stone-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm text-neutral-800">{msg.sender_name}</span>
                      <span className="text-xs text-stone-400">{msg.sender_email}</span>
                      {banned && (
                        <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-500">
                          {claimed ? 'Banned · Claimed' : 'Banned'}
                        </span>
                      )}
                    </div>
                    <p
                      className="text-sm text-neutral-700 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: highlight(msg.text) }}
                    />
                    <p className="text-xs text-stone-400 mt-1.5">
                      {new Date(msg.created_at).toLocaleString()}
                    </p>
                    {banned && msg.banned_until && (
                      <p className="text-xs text-rose-400 mt-1">
                        Banned until {new Date(msg.banned_until).toLocaleDateString()}
                        {claimed && msg.ban_claimed_at && (
                          <> · Claimed {new Date(msg.ban_claimed_at).toLocaleDateString()}</>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {banned ? (
                      <button
                        onClick={() => handleLiftBan(msg.sender_id)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-100 transition-colors"
                      >
                        Lift ban
                      </button>
                    ) : (
                      <button
                        onClick={() => openModal(msg)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-rose-500 text-white font-semibold hover:bg-rose-600 transition-colors"
                      >
                        Ban
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Ban modal */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4">
            <div>
              <h2 className="font-semibold text-neutral-900 mb-0.5">Ban {modal.sender_name}</h2>
              <p className="text-xs text-stone-400">{modal.sender_email}</p>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide block mb-1.5">Message shown to user</label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={3}
                className="w-full text-sm border border-stone-200 rounded-xl px-3 py-2 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-rose-200 resize-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide block mb-1.5">Duration</label>
              <div className="flex gap-2">
                {DURATIONS.map(d => (
                  <button
                    key={d.days}
                    onClick={() => setDuration(d.days)}
                    className={`flex-1 py-2 text-sm rounded-xl font-medium border transition-colors ${
                      duration === d.days
                        ? 'bg-rose-500 text-white border-rose-500'
                        : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setModal(null)}
                className="flex-1 py-2.5 text-sm border border-stone-200 text-stone-500 rounded-xl hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBan}
                disabled={banning || !reason.trim()}
                className="flex-1 py-2.5 text-sm bg-rose-500 text-white font-semibold rounded-xl hover:bg-rose-600 transition-colors disabled:opacity-40"
              >
                {banning ? 'Banning...' : `Ban for ${duration} days`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-stone-400 text-sm">Loading...</div>}>
      <AdminInner />
    </Suspense>
  );
}
