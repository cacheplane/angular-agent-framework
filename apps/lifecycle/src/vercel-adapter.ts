import { hasExactBearerToken } from './service-auth.js';

export interface DawnFetchApp {
  fetch(request: Request): Response | Promise<Response>;
}

export interface LifecycleVercelAdapter {
  fetch(request: Request): Promise<Response>;
}

const INTERNAL_FUNCTION_PREFIX = '/api';

function jsonError(status: number, error: string): Response {
  return Response.json(
    { error },
    { status, headers: { 'cache-control': 'no-store' } }
  );
}

function dawnRequestFromVercelRewrite(request: Request): Request | null {
  const url = new URL(request.url);
  if (url.pathname === INTERNAL_FUNCTION_PREFIX) {
    url.pathname = '/';
  } else if (url.pathname.startsWith(`${INTERNAL_FUNCTION_PREFIX}/`)) {
    url.pathname = url.pathname.slice(INTERNAL_FUNCTION_PREFIX.length);
  } else {
    return null;
  }
  return new Request(url, request);
}

export function createLifecycleVercelAdapter(
  dawnApp: DawnFetchApp,
  readSecret: () => string | undefined = () =>
    process.env['LIFECYCLE_SERVICE_SECRET']
): LifecycleVercelAdapter {
  return {
    async fetch(request: Request): Promise<Response> {
      const secret = readSecret();
      if (!secret) return jsonError(503, 'Service unavailable');
      if (
        !hasExactBearerToken(
          request.headers.get('authorization') ?? undefined,
          secret
        )
      ) {
        return jsonError(401, 'Unauthorized');
      }
      const dawnRequest = dawnRequestFromVercelRewrite(request);
      if (!dawnRequest) return jsonError(404, 'Not found');
      return dawnApp.fetch(dawnRequest);
    },
  };
}
