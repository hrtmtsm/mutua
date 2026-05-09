// Shared flag so PageTransition knows if the next route change is a back navigation.
// Set synchronously in back button click handlers BEFORE calling router.back(),
// because Next.js App Router re-renders before popstate fires.
export let pendingPop = false;
export function markPop() { pendingPop = true; }
export function consumePop(): boolean {
  const was = pendingPop;
  pendingPop = false;
  return was;
}
