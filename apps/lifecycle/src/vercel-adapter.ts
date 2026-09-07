import { hasExactBearerToken } from './service-auth.js';

export interface DawnFetchApp {
  fetch(
    request: Request,
    env: { DATABASE_URL: string }
  ): Response | Promise<Response>;
}

export interface LifecycleVercelAdapter {
  fetch(request: Request): Promise<Response>;
}

function jsonError(status: number, error: string): Response {
  return Response.json(
    { error },
    { status, headers: { 'cache-control': 'no-store' } }
  );
}

export function createLifecycleVercelAdapter(
  dawnApp: DawnFetchApp,
  readSecret: () => string | undefined = () =>
    process.env['LIFECYCLE_SERVICE_SECRET'],
  readDeploymentId: () => string | undefined = () =>
    process.env['VERCEL_DEPLOYMENT_ID'],
  readDawnDatabaseUrl: () => string | undefined = () =>
    process.env['DAWN_DATABASE_URL']
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
      const databaseUrl = readDawnDatabaseUrl()?.trim();
      if (!databaseUrl) return jsonError(503, 'Service unavailable');
      // Dawn binds stores to this exact request. Keep Growth's process-level
      // DATABASE_URL untouched and never fall back to it for runtime storage.
      const response = await dawnApp.fetch(request, {
        DATABASE_URL: databaseUrl,
      });
      if (new URL(request.url).pathname !== '/healthz') return response;
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
