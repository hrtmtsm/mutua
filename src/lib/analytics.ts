import posthog from 'posthog-js';

const TOKEN = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? '';
const HOST  = 'https://us.i.posthog.com';

let initialised = false;

export function initAnalytics() {
  if (typeof window === 'undefined' || initialised) return;
  if (!window.location.hostname.endsWith('trymutua.com')) return;
  posthog.init(TOKEN, {
    api_host:           HOST,
    capture_pageview:   false, // we'll capture manually
    capture_pageleave:  true,
    persistence:        'localStorage',
  });
  initialised = true;
}

export function identifyUser(sessionId: string, props?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  posthog.identify(sessionId, props);
}

export function track(event: string, props?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  posthog.capture(event, props);
}

export function trackPageview(path: string) {
  if (typeof window === 'undefined') return;
  posthog.capture('$pageview', { $current_url: path });
}
