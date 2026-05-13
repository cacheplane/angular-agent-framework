// SPDX-License-Identifier: MIT
/**
 * Production environment configuration for the canonical demo.
 *
 * Uses a relative /api URL — Vercel routes /api/* to the
 * langgraph-proxy serverless function (scripts/demo-middleware.ts),
 * which injects x-api-key server-side and proxies to the shared
 * cockpit-dev LangGraph Cloud assistant.
 */
export const environment = {
  production: true,
  langGraphApiUrl: '/api',
  assistantId: 'chat',
};
