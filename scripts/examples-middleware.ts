/**
 * Vercel Serverless Function proxy for the threadplane-examples deployment.
 *
 * Thin wrapper around scripts/langgraph-proxy.ts that adds the
 * examples-specific Referer-based backend resolution. Today there's
 * a single shared backend, but the resolver pattern keeps the door
 * open for future fan-out.
 *
 * Deployed as api/[[...path]].js by scripts/assemble-examples.ts.
 */
import { createProxyHandler } from './langgraph-proxy';

const SHARED_DEPLOYMENT_URL = 'https://cockpit-dev-219a15942c545a00a03a9a41905d7fc2.us.langgraph.app';

const ACTIVE_PRODUCT_PATHS = new Set([
  'langgraph/streaming',
  'langgraph/persistence',
  'langgraph/interrupts',
  'langgraph/memory',
  'langgraph/durable-execution',
  'langgraph/subgraphs',
  'langgraph/time-travel',
  'langgraph/deployment-runtime',
  'deep-agents/planning',
  'deep-agents/filesystem',
  'deep-agents/subagents',
  'deep-agents/memory',
  'deep-agents/skills',
  'deep-agents/sandboxes',
  'chat/messages',
  'chat/input',
  'chat/interrupts',
  'chat/tool-calls',
  'chat/subagents',
  'chat/threads',
  'chat/timeline',
  'chat/generative-ui',
  'chat/debug',
  'chat/theming',
  'chat/a2ui',
]);

function isActiveProductPath(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length < 2) return false;
  return ACTIVE_PRODUCT_PATHS.has(`${segments[0]}/${segments[1]}`);
}

function resolveBackend(referer: string | undefined): string {
  if (!referer) return SHARED_DEPLOYMENT_URL;
  try {
    const url = new URL(referer);
    if (isActiveProductPath(url.pathname)) return SHARED_DEPLOYMENT_URL;
  } catch {
    // Ignore invalid referers and fall back.
  }
  return SHARED_DEPLOYMENT_URL;
}

module.exports = createProxyHandler({ resolveBackend, backendUrl: SHARED_DEPLOYMENT_URL });
