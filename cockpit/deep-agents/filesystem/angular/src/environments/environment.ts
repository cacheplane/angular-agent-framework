/**
 * Production environment configuration.
 *
 * Uses relative /api URL — Vercel middleware proxies to LangGraph Cloud
 * and injects the x-api-key header server-side.
 */
export const environment = {
  production: true,
  langGraphApiUrl: '/api',
  streamingAssistantId: 'filesystem',
};
