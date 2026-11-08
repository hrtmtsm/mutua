'use client';
import VoiceHistory from '@/components/VoiceHistory';
import AppShell from '@/components/AppShell';
import { useLocale } from '@/components/LocaleProvider';

export default function ExchangesPage() {
  const { t } = useLocale();

  return (
    <AppShell>
      <main className="flex-1 px-6 pt-2 pb-10 md:py-10 max-w-3xl mx-auto w-full space-y-6">
        <h1 className="hidden md:block font-serif font-semibold text-2xl text-[#171717]">{t('nav.log')}</h1>
        <VoiceHistory />
      </main>
    </AppShell>
  );
}
