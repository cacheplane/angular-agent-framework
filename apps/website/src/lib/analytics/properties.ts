const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com';

export type CaptureConfig = {
  token?: string;
  captureLocal?: boolean;
  host?: string;
};

export function toSafeAnalyticsString(value: unknown, maxLength = 200): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

export function getEmailDomain(email: unknown): string | null {
  const value = toSafeAnalyticsString(email, 320);
  if (!value) return null;

  const atIndex = value.lastIndexOf('@');
  if (atIndex <= 0 || atIndex === value.length - 1) return null;

  const domain = value.slice(atIndex + 1).toLowerCase();
  return domain.includes('.') ? domain : null;
}

export function getSourcePage(value: unknown): string {
  const source = toSafeAnalyticsString(value, 2000);
  if (!source) return '/';

  if (source.startsWith('/')) return source;

  try {
    const url = new URL(source);
    return `${url.pathname}${url.search}${url.hash}` || '/';
  } catch {
    return '/';
  }
}

export function isLocalAnalyticsHost(host: unknown): boolean {
  const value = toSafeAnalyticsString(host, 300)?.toLowerCase();
  if (!value) return false;

  const hostname = value.split(':')[0];
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

export function shouldCaptureAnalytics({ token, captureLocal = false, host }: CaptureConfig): boolean {
  if (!toSafeAnalyticsString(token, 500)) return false;
  if (isLocalAnalyticsHost(host) && !captureLocal) return false;
  return true;
}

export function normalizePostHogHost(host: unknown): string {
  const value = toSafeAnalyticsString(host, 500);
  if (!value) return DEFAULT_POSTHOG_HOST;
  return value.endsWith('/') ? value.slice(0, -1) : value;
}
