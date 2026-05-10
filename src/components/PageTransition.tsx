'use client';

import { usePathname } from 'next/navigation';
import { useRef } from 'react';
import { consumePop, markPop, peekPop } from '@/lib/navigation';

const TAB_ROUTES = ['/app', '/exchanges', '/history', '/settings'];
const isTab = (p: string) => TAB_ROUTES.some(r => p === r || p.startsWith(r + '/'));

// Fallback for browser back gesture / hardware button.
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => markPop(), { capture: true });
}

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prevRef  = useRef(pathname);

  const prev    = prevRef.current;
  const changed = prev !== pathname;
  const isTabSwitch = isTab(prev) && isTab(pathname);
  const isPop   = changed && peekPop();

  if (changed) {
    prevRef.current = pathname;
    consumePop();
  }

  // Push → slide in from right. Pop → slide in from left.
  const cls =
    !changed || isTabSwitch ? '' :
    isPop ? 'page-pop-in' : 'page-push-in';

  return (
    <div key={pathname} className={cls}>
      {children}
    </div>
  );
}
