// SPDX-License-Identifier: MIT
import { Client } from '@langchain/langgraph-sdk';
import type { LangGraphClientOptions } from '../agent.types';

/**
 * Construct a LangGraph SDK Client that accepts both absolute URLs
 * (`http://localhost:2024`) and relative `/api`-style paths that get
 * proxied by middleware in production. The SDK itself rejects
 * relative URLs, so this helper rewrites them against
 * `window.location.origin` when running in the browser.
 *
 * Single source of truth for the absolute-URL rewrite — the streaming
 * transport (`fetch-stream.transport.ts`) and the threads adapter
 * (`LangGraphThreadsAdapter`) both go through here.
 *
 * `clientOptions.maxRetries` maps to the SDK's `callerOptions.maxRetries`,
 * which governs how many times a failed request (including the initial
 * stream connect) is retried with exponential backoff before the error
 * surfaces. Omitted → the SDK default (currently 4). Apps under test set
 * `0` so a forced connection failure surfaces immediately instead of after
 * the full backoff window.
 *
 * @example
 * ```ts
 * const client = createLangGraphClient(environment.langGraphApiUrl);
 * const threads = await client.threads.search({ limit: 50 });
 * ```
 */
export function createLangGraphClient(
  apiUrl: string,
  clientOptions?: LangGraphClientOptions,
): Client {
  return new Client({
    apiUrl: toAbsoluteApiUrl(apiUrl),
    ...(clientOptions?.maxRetries !== undefined
      ? { callerOptions: { maxRetries: clientOptions.maxRetries } }
      : {}),
  });
}

/** Exported separately so non-Client callers (e.g. raw fetch) can
 *  share the same normalization logic. */
export function toAbsoluteApiUrl(apiUrl: string): string {
  if (apiUrl.startsWith('http://') || apiUrl.startsWith('https://')) return apiUrl;
  return typeof window !== 'undefined' ? `${window.location.origin}${apiUrl}` : apiUrl;
}
