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

function dawnRequestFromVercelRewrite(request: Request): Request {
  const url = new URL(request.url);
  if (url.pathname === INTERNAL_FUNCTION_PREFIX) {
    url.pathname = '/';
  } else if (url.pathname.startsWith(`${INTERNAL_FUNCTION_PREFIX}/`)) {
    url.pathname = url.pathname.slice(INTERNAL_FUNCTION_PREFIX.length);
  } else {
    // Vercel rewrites can preserve the public URL presented to the function.
    return request;
  }
  return new Request(url, request);
}

export function createLifecycleVercelAdapter(
  dawnApp: DawnFetchApp,
  readSecret: () => string | undefined = () =>
    process.env['LIFECYCLE_SERVICE_SECRET'],
  readDeploymentId: () => string | undefined = () =>
    process.env['VERCEL_DEPLOYMENT_ID']
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
      const response = await dawnApp.fetch(dawnRequest);
      if (new URL(dawnRequest.url).pathname !== '/healthz') return response;
      const deploymentId = readDeploymentId()?.trim();
      if (!deploymentId) return response;
      const headers = new Headers(response.headers);
      headers.set('x-threadplane-deployment-id', deploymentId);
      return new Response(response.body, {
        headers,
        status: response.status,
        statusText: response.statusText,
      });
    },
  };
}
