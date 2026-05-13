// scripts/demo-middleware.ts
// SPDX-License-Identifier: MIT
/**
 * Vercel Serverless Function proxy for the canonical-demo deployment
 * (demo.cacheplane.ai). Five-line wrapper around the shared
 * scripts/langgraph-proxy.ts factory using defaults — single backend,
 * no Referer-based fan-out.
 */
import { createProxyHandler } from './langgraph-proxy';
module.exports = createProxyHandler({});
