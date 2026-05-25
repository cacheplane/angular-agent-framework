// SPDX-License-Identifier: MIT
'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';
import { getCockpitSessionId } from '../lib/analytics/distinct-id';
import { shouldCaptureAnalytics } from '@threadplane/telemetry/browser';

/**
 * Client-side analytics bootstrap. Initializes posthog-js once per
 * client process when env + privacy gates pass.
 *
 * Mounted from the root layout. Renders nothing. Idempotent — re-renders
 * (e.g. fast-refresh) check `__loaded` before re-initializing.
 */
export function AnalyticsBootstrap(): null {
  useEffect(() => {
    if ((posthog as unknown as { __loaded?: boolean }).__loaded) {
      return;
    }
    const token = process.env.NEXT_PUBLIC_COCKPIT_POSTHOG_TOKEN;
    const captureLocal = process.env.NEXT_PUBLIC_COCKPIT_CAPTURE_LOCAL === 'true';
    const host = typeof window === 'undefined' ? undefined : window.location.host;
    if (!shouldCaptureAnalytics({ token, captureLocal, host })) {
      return;
    }
    posthog.init(token as string, {
      api_host: '/ingest',
      ui_host: 'https://us.posthog.com',
      persistence: 'memory',
      bootstrap: { distinctID: getCockpitSessionId() },
      autocapture: false,
      capture_pageview: false,
      defaults: '2026-01-30',
    });
  }, []);
  return null;
}
