'use client';

import { LoaderCircle } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';

export function LoadingStatus() {
 const { locale } = useLocale();
 const labels = { ja: '読み込み中…', en: 'Loading…', ko: '불러오는 중…', zh: '正在加载…', es: 'Cargando…', fr: 'Chargement…', de: 'Wird geladen…', pt: 'Carregando…', vi: 'Đang tải…' };
 return (
  <div role="status" className="flex items-center justify-center gap-2 py-8 text-sm">
   <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" />
   {labels[locale]}
  </div>
 );
}

export default function Loading() {
 return <div className="grid min-h-[50dvh] place-items-center"><LoadingStatus /></div>;
}
