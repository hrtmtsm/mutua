'use client';
import VoiceHistory from '@/components/VoiceHistory';
import AppShell from '@/components/AppShell';
import { useLocale } from '@/components/LocaleProvider';

export default function ExchangesPage() {
  const { t } = useLocale();

  return (
    <AppShell>
      <main style={{ fontFamily: "var(--font-logo), Figtree, sans-serif" }} className="live-exchange-scene flex h-[calc(100dvh-8.5rem)] flex-col overflow-hidden md:h-dvh">
        <div className="mx-auto flex w-full max-w-[1248px] shrink-0 flex-col px-4 md:px-6">
          <header className="hidden py-6 md:block">
            <h1 className="text-2xl font-bold tracking-tight">{t('nav.log')}</h1>
          </header>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 md:px-6">
          <div className="mx-auto w-full max-w-3xl">
            <VoiceHistory />
          </div>
        </div>
      </main>
    </AppShell>
  );
}
