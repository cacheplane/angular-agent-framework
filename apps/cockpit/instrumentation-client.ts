// SPDX-License-Identifier: MIT
import posthog from 'posthog-js';
import { getCockpitSessionId } from './src/lib/analytics/distinct-id';
import { shouldCaptureAnalytics } from './src/lib/analytics/properties';

const token = process.env.NEXT_PUBLIC_COCKPIT_POSTHOG_TOKEN;
const captureLocal = process.env.NEXT_PUBLIC_COCKPIT_CAPTURE_LOCAL === 'true';
const host = typeof window === 'undefined' ? undefined : window.location.host;
const doNotTrack = typeof navigator !== 'undefined' && navigator.doNotTrack === '1';

if (shouldCaptureAnalytics({ token, captureLocal, host, doNotTrack })) {
  posthog.init(token!, {
    api_host: process.env.NEXT_PUBLIC_COCKPIT_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    persistence: 'memory',
    bootstrap: { distinctID: getCockpitSessionId() },
    autocapture: false,
    capture_pageview: false,
    defaults: '2026-01-30',
  });
}
