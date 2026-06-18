// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { AgentError } from './agent-error';
import { toAgentError, isAbortError } from './to-agent-error';

describe('toAgentError', () => {
  it('classifies HTTP 500 message as server + retryable + status', () => {
    const e = toAgentError(new Error('HTTP 500: Internal Server Error'));
    expect(e).toBeInstanceOf(AgentError);
    expect(e.kind).toBe('server'); expect(e.retryable).toBe(true); expect(e.status).toBe(500);
  });
  it('classifies 401 as auth + not retryable', () => {
    const e = toAgentError(new Error('HTTP 401: Unauthorized'));
    expect(e.kind).toBe('auth'); expect(e.retryable).toBe(false); expect(e.status).toBe(401);
  });
  it('classifies non-auth 4xx as server + not retryable', () => {
    const e = toAgentError(new Error('HTTP 404: Not Found'));
    expect(e.kind).toBe('server'); expect(e.retryable).toBe(false); expect(e.status).toBe(404);
  });
  it('classifies fetch failure as connection + retryable', () => {
    const e = toAgentError(new TypeError('Failed to fetch'));
    expect(e.kind).toBe('connection'); expect(e.retryable).toBe(true);
  });
  it('classifies AbortError as aborted + not retryable', () => {
    const ab = new Error('The operation was aborted'); ab.name = 'AbortError';
    const e = toAgentError(ab);
    expect(e.kind).toBe('aborted'); expect(e.retryable).toBe(false);
    expect(isAbortError(ab)).toBe(true);
  });
  it('preserves cause and is idempotent', () => {
    const raw = new Error('HTTP 500: boom');
    const once = toAgentError(raw);
    expect(once.cause).toBe(raw);
    expect(toAgentError(once)).toBe(once);
  });
  it('falls back to server + retryable for unknown shapes', () => {
    const e = toAgentError({ weird: true });
    expect(e.kind).toBe('server'); expect(e.retryable).toBe(true);
  });
  it('reads a structured status off the error/cause', () => {
    const e = toAgentError({ status: 503, message: 'Service Unavailable' });
    expect(e.kind).toBe('server'); expect(e.status).toBe(503); expect(e.retryable).toBe(true);
  });
});
