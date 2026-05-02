import { createHash } from 'crypto';
import { PostHog } from 'posthog-node';
import { analyticsEvents, type AnalyticsEventName, type AnalyticsProperties, type WhitepaperId } from './events';
import { getEmailDomain, normalizePostHogHost, toSafeAnalyticsString } from './properties';

function getServerPostHogClient(): PostHog | null {
  const token = toSafeAnalyticsString(process.env.NEXT_PUBLIC_POSTHOG_TOKEN, 500);
  if (!token) return null;

  return new PostHog(token, {
    host: normalizePostHogHost(process.env.NEXT_PUBLIC_POSTHOG_HOST),
    flushAt: 1,
    flushInterval: 0,
  });
}

function getHashedEmailDistinctId(email: unknown): string | null {
  const value = toSafeAnalyticsString(email, 320)?.toLowerCase();
  if (!value || !getEmailDomain(value)) return null;
  return `email_sha256:${createHash('sha256').update(value).digest('hex')}`;
}

export async function captureServerEvent({
  distinctId,
  event,
  properties,
}: {
  distinctId: string;
  event: AnalyticsEventName;
  properties?: AnalyticsProperties;
}) {
  const posthog = getServerPostHogClient();
  if (!posthog) return;

  let didShutdown = false;
  try {
    posthog.capture({
      distinctId,
      event,
      properties,
    });
    await posthog.shutdown();
    didShutdown = true;
  } catch (err) {
    console.error('[posthog] capture failed:', err);
  } finally {
    if (!didShutdown) {
      await posthog.shutdown().catch(() => undefined);
    }
  }
}

export async function captureLeadConversion({
  email,
  company,
  sourcePage,
}: {
  email: string;
  company?: string;
  sourcePage?: string;
}) {
  const distinctId = getHashedEmailDistinctId(email);
  if (!distinctId) return;

  await captureServerEvent({
    distinctId,
    event: analyticsEvents.marketingLeadFormSuccess,
    properties: {
      email_domain: getEmailDomain(email) ?? undefined,
      company: toSafeAnalyticsString(company, 200),
      source_page: sourcePage,
    },
  });
}

export async function captureWhitepaperConversion({
  email,
  paper,
  sourcePage,
}: {
  email: string;
  paper: WhitepaperId;
  sourcePage?: string;
}) {
  const distinctId = getHashedEmailDistinctId(email);
  if (!distinctId) return;

  await captureServerEvent({
    distinctId,
    event: analyticsEvents.marketingWhitepaperSignupSuccess,
    properties: {
      email_domain: getEmailDomain(email) ?? undefined,
      paper,
      source_page: sourcePage,
    },
  });
}

export async function captureNewsletterConversion({ email, sourcePage }: { email: string; sourcePage?: string }) {
  const distinctId = getHashedEmailDistinctId(email);
  if (!distinctId) return;

  await captureServerEvent({
    distinctId,
    event: analyticsEvents.marketingNewsletterSignupSuccess,
    properties: {
      email_domain: getEmailDomain(email) ?? undefined,
      source_page: sourcePage,
    },
  });
}
