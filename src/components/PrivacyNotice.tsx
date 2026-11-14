'use client';

import Link from 'next/link';
import { useLocale } from './LocaleProvider';

export function PrivacyLink({
  section,
  label = 'privacy.title',
  onClick,
}: {
  section?: 'call-transcription' | 'ai-practice' | 'ai-review';
  label?: 'privacy.title' | 'privacy.details';
  onClick?: (e: React.MouseEvent) => void;
}) {
  const { t } = useLocale();

  return (
    <Link
      href={section ? `/privacy#${section}` : '/privacy'}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-2"
      onClick={onClick}
    >
      {t(label)}
    </Link>
  );
}

export function SignupPrivacyNotice({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  const { t } = useLocale();

  return (
    <label className="flex items-start gap-2 text-xs leading-relaxed text-pretty cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#2b2b2b]"
      />
      <span>
        {t('privacy.agreePrefix')}
        <PrivacyLink onClick={e => e.stopPropagation()} />
        {t('privacy.agreeSuffix')}
      </span>
    </label>
  );
}
