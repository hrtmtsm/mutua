'use client';

import Link from 'next/link';
import { useLocale } from './LocaleProvider';

export function PrivacyLink({
  section,
  label = 'privacy.title',
}: {
  section?: 'call-transcription' | 'ai-practice' | 'ai-review';
  label?: 'privacy.title' | 'privacy.details';
}) {
  const { t } = useLocale();

  return (
    <Link
      href={section ? `/privacy#${section}` : '/privacy'}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-2"
    >
      {t(label)}
    </Link>
  );
}

export function SignupPrivacyNotice() {
  const { t } = useLocale();

  return (
    <p className="text-xs leading-relaxed text-pretty">
      {t('privacy.signupNotice')}{' '}
      <PrivacyLink />
    </p>
  );
}
