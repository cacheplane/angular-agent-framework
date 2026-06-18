// SPDX-License-Identifier: MIT
import { AgentError, AGENT_ERROR_MESSAGES, type AgentErrorKind } from './agent-error';

/** True when `raw` represents a user-requested abort. Shared by adapters + classifier. */
export function isAbortError(raw: unknown): boolean {
  return raw instanceof Error && (raw.name === 'AbortError' || /\babort/i.test(raw.message));
}

function readStatus(raw: unknown): number | undefined {
  const obj = raw as { status?: unknown; cause?: { status?: unknown } } | null;
  const direct = typeof obj?.status === 'number' ? obj.status : undefined;
  const viaCause = typeof obj?.cause?.status === 'number' ? obj!.cause!.status : undefined;
  if (direct !== undefined) return direct;
  if (viaCause !== undefined) return viaCause;
  const msg = raw instanceof Error ? raw.message : typeof raw === 'string' ? raw : '';
  const m = /\b(\d{3})\b/.exec(msg);
  return m ? Number(m[1]) : undefined;
}

function isConnectionError(raw: unknown): boolean {
  if (!(raw instanceof Error)) return false;
  return /failed to fetch|networkerror|econnrefused|enotfound|network request failed|load failed/i.test(
    `${raw.name} ${raw.message}`,
  );
}

function make(kind: AgentErrorKind, retryable: boolean, raw: unknown, status?: number, message?: string): AgentError {
  return new AgentError({ kind, retryable, status, cause: raw, message: message ?? AGENT_ERROR_MESSAGES[kind] });
}

/** Classify any raw error into a structured {@link AgentError}. Idempotent. */
export function toAgentError(raw: unknown): AgentError {
  if (raw instanceof AgentError) return raw;
  if (isAbortError(raw)) return make('aborted', false, raw);

  const status = readStatus(raw);
  if (status !== undefined) {
    if (status === 401 || status === 403) return make('auth', false, raw, status);
    if (status >= 500) return make('server', true, raw, status);
    if (status >= 400) return make('server', false, raw, status, `The request was rejected (HTTP ${status}).`);
  }
  if (isConnectionError(raw)) return make('connection', true, raw);

  const msg = raw instanceof Error && raw.message ? raw.message : 'Something went wrong. You can try again.';
  return make('server', true, raw, status, msg);
}
