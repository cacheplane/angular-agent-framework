// scripts/demo-middleware.ts
// SPDX-License-Identifier: MIT
/**
 * Vercel Serverless Function proxy for the canonical-demo deployment
 * (demo.cacheplane.ai). Wraps the shared langgraph-proxy factory with
 * the rate-limit gate from scripts/rate-limit.ts.
 *
 * The rate-limit hook is wired here (not in the shared factory) so the
 * cockpit-examples wrapper stays unaffected — its bundle does not pull
 * in @neondatabase/serverless.
 *
 * Note: changes to scripts/rate-limit.ts MUST trigger a redeploy of this
 * function. The ci.yml `Check if demo changed` step watches
 * scripts/(assemble-demo|demo-middleware|langgraph-proxy|rate-limit)\.ts.
 * Keep that regex in sync if you split rate-limit into multiple files.
 */
import { createProxyHandler } from './langgraph-proxy';
import { checkRateLimit } from './rate-limit';

module.exports = createProxyHandler({ checkRateLimit });
