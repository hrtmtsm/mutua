'use client';

import { usePathname } from 'next/navigation';
import { useLayoutEffect, useRef, useState } from 'react';

const TAB_ROUTES = ['/app', '/exchanges', '/history', '/settings'];
const isTab = (p: string) => TAB_ROUTES.some(r => p === r || p.startsWith(r + '/'));

// Register BEFORE Next.js processes popstate (capture phase runs first).
// This ensures _pendingPop is true when React re-renders with the new pathname.
let _pendingPop = false;
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => { _pendingPop = true; }, { capture: true });
}

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prevRef = useRef(pathname);
  const shouldOverlayRef = useRef(false);
  const [showOverlay, setShowOverlay] = useState(false);

  // Compute direction synchronously during render so enterCls is correct
  // on the very first paint (useEffect would be too late for CSS animations).
  const prev = prevRef.current;
  const pathnameChanged = prev !== pathname;
  const isTabSwitch = isTab(prev) && isTab(pathname);
  let isPop = false;

  if (pathnameChanged) {
    isPop = _pendingPop;
    _pendingPop = false;
    prevRef.current = pathname;
    shouldOverlayRef.current = isPop && !isTabSwitch;
  }

  // For pop: incoming page has no animation; a white overlay slides right instead.
  // For push: incoming page slides in from the right.
  const enterCls = pathnameChanged && !isTabSwitch && !isPop ? 'page-push-in' : '';

  // Show overlay before first paint so there's no flash of the new page.
  useLayoutEffect(() => {
    if (shouldOverlayRef.current) {
      shouldOverlayRef.current = false;
      setShowOverlay(true);
    }
  }, [pathname]);

  return (
    <>
      <div key={pathname} className={enterCls}>
        {children}
      </div>
      {showOverlay && (
        <div
          className="fixed inset-0 z-50 bg-white page-pop-out pointer-events-none"
          onAnimationEnd={() => setShowOverlay(false)}
        />
      )}
    </>
  );
}
