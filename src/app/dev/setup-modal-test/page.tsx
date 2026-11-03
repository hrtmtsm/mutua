'use client';

// DEV-ONLY — isolated harness to verify SetupModal's auth/login/email-confirm/
// returning-user branching with REAL Supabase calls, before it's wired into
// the production /app screen (Phase 4). Not linked from production nav.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import SetupModal from '@/components/SetupModal';

interface AuthSnapshot {
  signedIn: boolean;
  email?:   string;
  nativeLanguage?: string | null;
  learningLanguage?: string | null;
}

export default function SetupModalTestPage() {
  const [snapshot, setSnapshot] = useState<AuthSnapshot>({ signedIn: false });
  const [modalOpen, setModalOpen] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const addLog = (line: string) =>
    setLog(prev => [`${new Date().toLocaleTimeString()}  ${line}`, ...prev].slice(0, 20));

  const refreshSnapshot = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.email) {
      setSnapshot({ signedIn: false });
      return;
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('native_language, learning_language')
      .eq('email', session.user.email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setSnapshot({
      signedIn: true,
      email: session.user.email,
      nativeLanguage: profile?.native_language ?? null,
      learningLanguage: profile?.learning_language ?? null,
    });
  }, []);

  useEffect(() => { refreshSnapshot(); }, [refreshSnapshot]);

  // Also re-check whenever we return from the email-confirmation link
  // (/auth/callback will have redirected back here with a fresh session).
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(() => { refreshSnapshot(); });
    return () => sub.subscription.unsubscribe();
  }, [refreshSnapshot]);

  const needsSetup = () => !snapshot.signedIn || !snapshot.nativeLanguage || !snapshot.learningLanguage;

  const triggerAction = (label: string) => {
    if (needsSetup()) {
      addLog(`(${label}) 未設定 → SetupModalを開く`);
      setModalOpen(true);
    } else {
      addLog(`(${label}) 設定済み → 本物の通話フローへ進む(今回は未実装、ここで止まる)`);
    }
  };

  const handleComplete = () => {
    addLog('SetupModal: 設定完了 → モーダルを閉じる(マイク取得・通話開始はしない)');
    setModalOpen(false);
    refreshSnapshot();
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('mutua_session_id');
    localStorage.removeItem('mutua_profile');
    addLog('サインアウトしました');
    refreshSnapshot();
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center px-6 py-12 gap-8">
      <div className="w-full max-w-md text-center space-y-1">
        <p className="text-xs font-semibold tracking-wide text-amber-600 bg-amber-50 inline-block px-3 py-1 rounded-full">
          DEV専用 — SetupModal検証ハーネス(本番/appとは未接続)
        </p>
        <h1 className="font-serif font-black text-2xl text-neutral-900 pt-2">地球儀(ダミー背景)</h1>
        <p className="text-sm text-stone-500">
          下の3ボタンが本番の「話してみる」「今すぐ話す」「通話受付をON」を模しています。
        </p>
      </div>

      <div className="w-full max-w-md bg-white border border-stone-200 rounded-xl p-4 text-sm space-y-1">
        <p className="font-semibold text-neutral-900">現在の状態</p>
        <p>認証: {snapshot.signedIn ? `✅ ${snapshot.email}` : '未認証'}</p>
        <p>母語: {snapshot.nativeLanguage ?? '未設定'}</p>
        <p>学習言語: {snapshot.learningLanguage ?? '未設定'}</p>
        {snapshot.signedIn && (
          <button onClick={handleSignOut} className="mt-2 text-xs text-red-500 underline">
            サインアウト(再テスト用)
          </button>
        )}
      </div>

      <div className="w-full max-w-md flex flex-col gap-2">
        <button
          onClick={() => triggerAction('話してみる')}
          className="w-full py-3 rounded-full bg-neutral-900 text-white font-semibold text-sm"
        >
          (a) 話してみる(テスト)
        </button>
        <button
          onClick={() => triggerAction('今すぐ話す')}
          className="w-full py-3 rounded-full bg-neutral-900 text-white font-semibold text-sm"
        >
          (b) 今すぐ話す
        </button>
        <button
          onClick={() => triggerAction('通話受付をON')}
          className="w-full py-3 rounded-full bg-neutral-900 text-white font-semibold text-sm"
        >
          (c) 通話受付をON
        </button>
      </div>

      <div className="w-full max-w-md bg-neutral-900 text-neutral-100 rounded-xl p-4 text-xs font-mono space-y-1 max-h-60 overflow-y-auto">
        {log.length === 0 && <p className="text-neutral-500">(ログはここに表示されます)</p>}
        {log.map((l, i) => <p key={i}>{l}</p>)}
      </div>

      <SetupModal open={modalOpen} onClose={() => setModalOpen(false)} onComplete={handleComplete} />
    </div>
  );
}
