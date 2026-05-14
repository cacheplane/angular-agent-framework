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
 */
import { createProxyHandler } from './langgraph-proxy';
import { checkRateLimit } from './rate-limit';

module.exports = createProxyHandler({ checkRateLimit });
