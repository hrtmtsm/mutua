// Shared flag so PageTransition knows if the next route change is a back navigation.
// Set synchronously in back button click handlers BEFORE calling router.back(),
// because Next.js App Router re-renders before popstate fires.
export let pendingPop = false;
export function markPop() { pendingPop = true; }
// Read without side-effect — safe to call during React render (concurrent mode).
export function peekPop(): boolean { return pendingPop; }
// Consume (clear) — call only from useLayoutEffect, never during render.
export function consumePop(): void { pendingPop = false; }
