// SPDX-License-Identifier: MIT
import { InjectionToken } from '@angular/core';

export type RuntimeOperationFailureReporter = (
  code: 'unauthorized' | 'network_blocked'
) => void;

/** @internal Cockpit-only, generation-bound operation failure reporter. */
export const ɵAG_UI_RUNTIME_OPERATION_REPORTER =
  new InjectionToken<RuntimeOperationFailureReporter>(
    'ɵAG_UI_RUNTIME_OPERATION_REPORTER'
  );

const RESPONSE_STATUS_GETTER = typeof Response === 'undefined'
  ? undefined
  : Object.getOwnPropertyDescriptor(Response.prototype, 'status')?.get;
const SIGNAL_ABORTED_GETTER = typeof AbortSignal === 'undefined'
  ? undefined
  : Object.getOwnPropertyDescriptor(AbortSignal.prototype, 'aborted')?.get;

/** @internal Creates the only reporter-aware AG-UI fetch boundary. */
export function createRuntimeProtectedFetch(
  reportOperationFailure: RuntimeOperationFailureReporter,
): typeof fetch {
  return async (input, init) => {
    const signalState = inspectRequestSignal(init);
    if (signalState === 'invalid') throw new Error('The runtime request failed.');
    if (signalState === 'aborted') throw createAbortError();

    let response: Response;
    try {
      response = await globalThis.fetch(input, init);
    } catch {
      const rejectedSignalState = inspectRequestSignal(init);
      if (rejectedSignalState === 'invalid') throw new Error('The runtime request failed.');
      if (rejectedSignalState === 'aborted') throw createAbortError();
      safeReport(reportOperationFailure, 'network_blocked');
      throw new Error('The runtime request failed.');
    }
    const status = readNativeResponseStatus(response);
    if (status === null) return sanitizedFailureResponse();
    if (status >= 200 && status < 300) return response;
    if (status === 401 || status === 403) safeReport(reportOperationFailure, 'unauthorized');
    return sanitizedFailureResponse(status);
  };
}

function readNativeResponseStatus(response: Response): number | null {
  try {
    if (!RESPONSE_STATUS_GETTER) return null;
    const status = RESPONSE_STATUS_GETTER.call(response) as unknown;
    return typeof status === 'number' ? status : null;
  } catch {
    return null;
  }
}

function sanitizedFailureResponse(status = 500): Response {
  return new Response(null, { status });
}

type SignalState = 'absent' | 'active' | 'aborted' | 'invalid';

function inspectRequestSignal(init: RequestInit | undefined): SignalState {
  try {
    return inspectSignal(init?.signal);
  } catch {
    return 'invalid';
  }
}

function inspectSignal(signal: AbortSignal | null | undefined): SignalState {
  if (signal == null) return 'absent';
  if (!SIGNAL_ABORTED_GETTER) return 'invalid';
  try {
    const aborted = SIGNAL_ABORTED_GETTER.call(signal) as unknown;
    if (typeof aborted !== 'boolean') return 'invalid';
    return aborted ? 'aborted' : 'active';
  } catch {
    return 'invalid';
  }
}

function createAbortError(): Error {
  const error = new Error('AbortError');
  error.name = 'AbortError';
  return error;
}

function safeReport(
  reporter: RuntimeOperationFailureReporter,
  code: 'unauthorized' | 'network_blocked',
): void {
  try {
    reporter(code);
  } catch {
    // Reporting must never change the runtime request outcome.
  }
}
