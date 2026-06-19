// SPDX-License-Identifier: MIT

/**
 * The failure class of an {@link AgentError}, used to drive UI and retry logic:
 *
 * - `connection` — offline / DNS / connection refused / `fetch` failed. Retryable.
 * - `auth` — `401` / `403`; credentials or API key are wrong. Not retryable.
 * - `server` — a `5xx` (retryable) or a non-auth `4xx` like `400`/`404`/`429` (not retryable).
 * - `interrupted` — the stream closed mid-response after a run had started. Retryable.
 * - `aborted` — the user pressed stop; treated as a graceful idle, not surfaced as an error.
 */
export type AgentErrorKind = 'connection' | 'auth' | 'server' | 'interrupted' | 'aborted';

/**
 * Structured, classified failure surfaced on `Agent.error`. Extends `Error`, so
 * existing `.message` / `instanceof Error` reads keep working — but adds a
 * machine-readable {@link AgentErrorKind}, a `retryable` flag, an optional HTTP
 * `status`, and the original `cause`.
 *
 * You rarely construct one yourself; adapters normalize raw failures via
 * {@link toAgentError}. Read it off the agent to render legible, cause-specific UI:
 *
 * @example
 * ```ts
 * const err = agent.error();            // AgentError | undefined
 * if (err) {
 *   console.warn(err.message);          // legible, per-kind copy
 *   if (err.kind === 'auth') showApiKeyHelp();
 *   if (err.retryable) showRetryButton(); // → agent.retry()
 * }
 * ```
 */
export class AgentError extends Error {
  /** The classified failure type. See {@link AgentErrorKind}. */
  readonly kind: AgentErrorKind;
  /** Whether retrying the same request could plausibly succeed:
   *  `connection` | `server` (5xx) | `interrupted` → true; `auth` | `aborted` | non-auth `4xx` → false. */
  readonly retryable: boolean;
  /** The HTTP status code when the failure came from an HTTP response. */
  readonly status?: number;
  /** The original raw error this was classified from, preserved for debugging/telemetry. */
  override readonly cause: unknown;

  constructor(init: { kind: AgentErrorKind; message: string; retryable: boolean; status?: number; cause?: unknown }) {
    super(init.message);
    this.name = 'AgentError';
    this.kind = init.kind;
    this.retryable = init.retryable;
    this.status = init.status;
    this.cause = init.cause;
  }
}

/**
 * Default, human-facing copy per {@link AgentErrorKind}. Used as the message when
 * a classified error has no better text. Override by mapping `error.kind` to your
 * own strings in a custom error component.
 */
export const AGENT_ERROR_MESSAGES: Record<AgentErrorKind, string> = {
  connection: "Can't reach the server. Check your connection and try again.",
  auth: 'Authentication failed. Check your API key or credentials.',
  server: 'The server ran into an error. You can try again.',
  interrupted: 'The response was interrupted. Try again.',
  aborted: 'Stopped.',
};
