import posthog from 'posthog-js';
import {
  normalizePostHogHost,
  shouldCaptureAnalytics,
} from './src/lib/analytics/properties';

const token = process.env.NEXT_PUBLIC_POSTHOG_TOKEN;
const captureLocal = process.env.NEXT_PUBLIC_POSTHOG_CAPTURE_LOCAL === 'true';
const browserHost = typeof window === 'undefined' ? undefined : window.location.host;

if (shouldCaptureAnalytics({ token, captureLocal, host: browserHost })) {
  posthog.init(token!, {
    api_host: normalizePostHogHost(process.env.NEXT_PUBLIC_POSTHOG_HOST),
    defaults: '2026-01-30',
    capture_pageview: true,
  });
}
