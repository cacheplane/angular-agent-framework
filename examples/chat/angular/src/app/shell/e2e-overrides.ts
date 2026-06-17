// SPDX-License-Identifier: MIT
import type { LangGraphClientOptions } from '@threadplane/langgraph';

/**
 * Test-only escape hatch for the LangGraph SDK client tuning.
 *
 * Production keeps the SDK's resilient default (connect failures retry with
 * exponential backoff before the error surfaces — good for transient blips,
 * but a deliberate ~15s delay on a hard failure). e2e specs that force a
 * connection failure can't wait that long, so they set
 * `localStorage['THREADPLANE_E2E_MAX_RETRIES'] = '0'` (via
 * `page.addInitScript`, before the app bootstraps) to make the error surface
 * immediately.
 *
 * Returns `undefined` when the flag is absent — i.e. always in real use — so
 * the SDK default is preserved. Never reads anything in production.
 */
const E2E_MAX_RETRIES_KEY = 'THREADPLANE_E2E_MAX_RETRIES';

export function e2eClientOptions(): LangGraphClientOptions | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(E2E_MAX_RETRIES_KEY);
  } catch {
    return undefined; // storage blocked (e.g. sandboxed iframe) — ignore
  }
  if (raw === null || raw.trim() === '') return undefined;
  const maxRetries = Number(raw);
  if (!Number.isInteger(maxRetries) || maxRetries < 0) return undefined;
  return { maxRetries };
}
