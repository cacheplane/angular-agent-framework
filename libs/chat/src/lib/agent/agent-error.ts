// SPDX-License-Identifier: MIT
export type AgentErrorKind = 'connection' | 'auth' | 'server' | 'interrupted' | 'aborted';

/** Structured, classified failure surfaced on `Agent.error`. Extends `Error`
 *  so existing `.message` / `instanceof Error` reads keep working. */
export class AgentError extends Error {
  readonly kind: AgentErrorKind;
  /** connection | server | interrupted → true; auth | aborted | non-auth-4xx → false. */
  readonly retryable: boolean;
  readonly status?: number;
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

/** Default human-facing copy per kind. */
export const AGENT_ERROR_MESSAGES: Record<AgentErrorKind, string> = {
  connection: "Can't reach the server. Check your connection and try again.",
  auth: 'Authentication failed. Check your API key or credentials.',
  server: 'The server ran into an error. You can try again.',
  interrupted: 'The response was interrupted. Try again.',
  aborted: 'Stopped.',
};
