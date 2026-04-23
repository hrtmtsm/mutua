'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

// Tab routes never animate — switching between them should feel instant
const TAB_ROUTES = ['/app', '/exchanges', '/history', '/settings'];
const isTab = (p: string) => TAB_ROUTES.some(r => p === r || p.startsWith(r + '/'));

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prevPathname = useRef(pathname);
  const directionRef = useRef<'push' | 'pop'>('push');

  useEffect(() => {
    const handlePop = () => { directionRef.current = 'pop'; };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
  const isTabSwitch = isTab(prevPathname.current) && isTab(pathname);
  prevPathname.current = pathname;

  const skip = isDesktop || isTabSwitch;
  const cls = skip ? '' : directionRef.current === 'pop' ? 'page-pop-in' : 'page-push-in';
  directionRef.current = 'push';

  return (
    <div key={pathname} className={cls}>
      {children}
    </div>
  );
}
