import { NextResponse } from 'next/server';

const CACHE_CONTROL = 'public, max-age=86400';

const firstHeaderValue = (value: string | null) =>
  value?.split(',', 1)[0]?.trim() ?? '';

function safeProtocol(requestUrl: URL, forwardedProtocol: string) {
  const normalized = forwardedProtocol.toLowerCase().replace(/:$/, '');
  if (normalized === 'http' || normalized === 'https') return `${normalized}:`;
  if (requestUrl.protocol === 'http:' || requestUrl.protocol === 'https:') {
    return requestUrl.protocol;
  }
  return 'https:';
}

function safeHost(candidate: string, protocol: string) {
  if (!candidate || /[\s/\\?#@]/.test(candidate)) return null;
  try {
    const parsed = new URL(`${protocol}//${candidate}`);
    return parsed.host;
  } catch {
    return null;
  }
}

function effectiveOrigin(request: Request) {
  const requestUrl = new URL(request.url);
  const protocol = safeProtocol(
    requestUrl,
    firstHeaderValue(request.headers.get('x-forwarded-proto'))
  );
  const forwardedHost = safeHost(
    firstHeaderValue(request.headers.get('x-forwarded-host')),
    protocol
  );
  const host = safeHost(
    firstHeaderValue(request.headers.get('host')),
    protocol
  );
  return `${protocol}//${forwardedHost ?? host ?? requestUrl.host}`;
}

export function GET(request: Request) {
  const response = NextResponse.redirect(
    new URL('/icon.svg', effectiveOrigin(request)),
    308
  );
  response.headers.set('Cache-Control', CACHE_CONTROL);
  return response;
}
