'use client';

import posthog from 'posthog-js';
import { analyticsEvents, type AnalyticsEventName, type AnalyticsProperties } from './events';
import { getSourcePage, toSafeAnalyticsString } from './properties';

function currentSourcePage(): string {
  if (typeof window === 'undefined') return '/';
  return getSourcePage(window.location.href);
}

export function track(event: AnalyticsEventName, properties: AnalyticsProperties = {}) {
  if (typeof window === 'undefined') return;
  if (!posthog.__loaded) return;

  posthog.capture(event, {
    source_page: currentSourcePage(),
    ...properties,
  });
}

export function trackCtaClick(properties: AnalyticsProperties) {
  track(analyticsEvents.marketingCtaClick, properties);
}

export function trackExternalLinkClick(destinationUrl: string, properties: AnalyticsProperties) {
  track(analyticsEvents.marketingExternalLinkClick, {
    destination_url: toSafeAnalyticsString(destinationUrl, 1000),
    ...properties,
  });
}

export function trackWhitepaperDownloadClick(paper: AnalyticsProperties['paper'], properties: AnalyticsProperties) {
  track(analyticsEvents.marketingWhitepaperDownloadClick, {
    paper,
    ...properties,
  });
}
