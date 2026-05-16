// scripts/demo-middleware.ts
// SPDX-License-Identifier: MIT
/**
 * Vercel Serverless Function proxy for the canonical-demo deployment
 * (demo.cacheplane.ai). Wraps the shared langgraph-proxy factory with:
 *   - the rate-limit gate from scripts/rate-limit.ts (Phase 3)
 *   - CORS allowlist + body-byte cap from env (Phase 4)
 *
 * Note: changes to scripts/rate-limit.ts MUST trigger a redeploy of this
 * function. The ci.yml `Check if demo changed` step watches
 * scripts/(assemble-demo|demo-middleware|langgraph-proxy|rate-limit)\.ts.
 * Keep that regex in sync if you split rate-limit into multiple files.
 */
import { createProxyHandler } from './langgraph-proxy';
import { checkRateLimit } from './rate-limit';

const DEFAULT_ALLOWED_ORIGINS = ['https://demo.cacheplane.ai'];
const DEFAULT_MAX_BODY_BYTES = 8192;
const DEFAULT_TELEMETRY_INGEST_URL = 'https://cacheplane.ai/api/ingest';

const allowedOrigins = (() => {
  const raw = process.env['ALLOWED_ORIGINS'];
  if (!raw) return DEFAULT_ALLOWED_ORIGINS;
  const parsed = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return parsed.length > 0 ? parsed : DEFAULT_ALLOWED_ORIGINS;
})();

const maxBodyBytes = (() => {
  const raw = process.env['MAX_PROMPT_BYTES'];
  const parsed = raw ? Number(raw) : DEFAULT_MAX_BODY_BYTES;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_BODY_BYTES;
})();

const telemetryIngestUrl = process.env['TELEMETRY_INGEST_URL'] ?? DEFAULT_TELEMETRY_INGEST_URL;

module.exports = createProxyHandler({
  checkRateLimit,
  allowedOrigins,
  maxBodyBytes,
  telemetryIngestUrl,
});
