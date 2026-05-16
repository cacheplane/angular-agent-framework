// SPDX-License-Identifier: MIT
import posthog from 'posthog-js';
import { getCockpitSessionId } from './src/lib/analytics/distinct-id';
import { shouldCaptureAnalytics } from '@ngaf/telemetry/browser';

const token = process.env.NEXT_PUBLIC_COCKPIT_POSTHOG_TOKEN;
const captureLocal = process.env.NEXT_PUBLIC_COCKPIT_CAPTURE_LOCAL === 'true';
const host = typeof window === 'undefined' ? undefined : window.location.host;

if (shouldCaptureAnalytics({ token, captureLocal, host })) {
  posthog.init(token!, {
    api_host: '/ingest',
    ui_host: 'https://us.posthog.com',
    persistence: 'memory',
    bootstrap: { distinctID: getCockpitSessionId() },
    autocapture: false,
    capture_pageview: false,
    defaults: '2026-01-30',
  });
}
