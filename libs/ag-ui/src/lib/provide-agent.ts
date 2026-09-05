import { InjectionToken, inject, type Provider } from '@angular/core';
import { HttpAgent } from '@ag-ui/client';
import type { AgentRef, AgentRuntimeTelemetrySink } from '@threadplane/chat';
import { toAgent, ɵtoAgentWithProtectedErrors, type AgUiAgent } from './to-agent';
import {
  createRuntimeProtectedFetch,
  ɵAG_UI_RUNTIME_OPERATION_REPORTER,
} from './runtime-operation-reporter';

/**
 * Connection options for the AG-UI agent provider, passed to {@link provideAgent}.
 * Mirrors the underlying `HttpAgent` config (`@ag-ui/client`) plus an optional
 * telemetry sink.
 */
export interface AgentConfig {
  /** Endpoint URL of the AG-UI HTTP agent (e.g. `'http://localhost:8000/agent'`). Required. */
  url: string;
  /** Agent identifier, when the endpoint serves more than one agent. */
  agentId?: string;
  /** Thread to connect to on start; omit to begin a fresh conversation. */
  threadId?: string;
  /** Extra HTTP headers sent with every request (e.g. auth tokens). */
  headers?: Record<string, string>;
  /**
   * Omit to enable automatic development-only collection. Set `false` to disable.
   * An app-owned sink replaces the automatic destination and receives the
   * existing runtime lifecycle callbacks.
   */
  telemetry?: AgentRuntimeTelemetrySink | false;
}

/**
 * @internal — exported for spec access only. Consumers must use injectAgent().
 * Both `provideAgent` and `provideFakeAgent` register the result of `toAgent()`,
 * which is always an `AgUiAgent`, so the token is typed accordingly.
 */
export const AGENT = new InjectionToken<AgUiAgent>('AGENT');

/** @internal — shared factory for building an AgUiAgent from an AgentConfig or factory. */
function buildAgUiAgent(configOrFactory: AgentConfig | (() => AgentConfig)): AgUiAgent {
  // useFactory runs in an injection context, so a config factory may
  // call inject() to read runtime/DI state.
  const config =
    typeof configOrFactory === 'function' ? configOrFactory() : configOrFactory;
  const reportOperationFailure = inject(ɵAG_UI_RUNTIME_OPERATION_REPORTER, { optional: true });
  const source = new HttpAgent({
    url: config.url,
    ...(config.agentId !== undefined ? { agentId: config.agentId } : {}),
    ...(config.threadId !== undefined ? { threadId: config.threadId } : {}),
    ...(config.headers !== undefined ? { headers: config.headers } : {}),
    ...(reportOperationFailure !== null
      ? { fetch: createRuntimeProtectedFetch(reportOperationFailure) }
      : {}),
  });
  const options = { telemetry: config.telemetry };
  return reportOperationFailure === null
    ? toAgent(source, options)
    : ɵtoAgentWithProtectedErrors(source, options);
}

function isAgentRef<T>(x: unknown): x is AgentRef<T> {
  return typeof x === 'object' && x !== null && 'token' in x;
}

/**
 * Provides an Agent instance wired through HttpAgent and toAgent.
 * Constructs an HttpAgent from config and wraps it in the runtime-neutral
 * Agent contract via toAgent(). Returns a provider array suitable for
 * bootstrapApplication or TestBed.configureTestingModule().
 *
 * **Static vs factory config.** Pass a plain `AgentConfig` object when the
 * config is known up front. Pass a `() => AgentConfig` factory when the config
 * depends on runtime/DI state — the factory runs inside an Angular injection
 * context, so it may call `inject()` to read services or route params.
 *
 * **Typed state via AgentRef.** Pass a typed ref as the first argument to flow
 * the state shape from `provideAgent` to `injectAgent` without repeating the
 * generic at every call site.
 *
 * **Several agents at one injector level.** Each `provideAgent(ref, …)` call
 * builds its own agent, so two (or more) refs may be provided side by side in a
 * single `providers` array and `injectAgent(refA)` / `injectAgent(refB)` return
 * distinct agents. The ref-less `injectAgent()` resolves a single shared token,
 * which can only point at one of them: when more than one ref is provided at
 * the same level the **last** call wins. Always inject by ref when an injector
 * provides more than one agent.
 *
 * @example Typed state via AgentRef
 * ```ts
 * interface TripState { day: number; places: string[]; }
 * export const TRIP = createAgentRef<TripState>('trip');
 * // app.config.ts:
 * providers: [provideAgent(TRIP, { url: 'http://localhost:8000/agent' })]
 * // component:
 * const agent = injectAgent(TRIP); // AgUiAgent<TripState>
 * ```
 */
export function provideAgent<T = Record<string, unknown>>(
  ref: AgentRef<T>,
  configOrFactory: AgentConfig | (() => AgentConfig),
): Provider[];
export function provideAgent(
  configOrFactory: AgentConfig | (() => AgentConfig),
): Provider[];
export function provideAgent<T = Record<string, unknown>>(
  refOrConfig: AgentRef<T> | AgentConfig | (() => AgentConfig),
  maybeConfig?: AgentConfig | (() => AgentConfig),
): Provider[] {
  const ref = isAgentRef<T>(refOrConfig) ? refOrConfig : undefined;
  const configOrFactory = (ref ? maybeConfig : refOrConfig) as AgentConfig | (() => AgentConfig);
  if (!ref) {
    return [{ provide: AGENT, useFactory: () => buildAgUiAgent(configOrFactory) }];
  }
  // Ref form: the agent is built under this call's own ref token, so N refs can
  // coexist in one `providers` array. The shared AGENT token aliases it — with a
  // single ref that reproduces the old `useExisting` identity exactly (one
  // instance, one config evaluation); with several refs AGENT can only mean one
  // thing, so the last call wins.
  return [
    { provide: ref.token, useFactory: () => buildAgUiAgent(configOrFactory) },
    { provide: AGENT, useExisting: ref.token },
  ];
}

/**
 * Injects the AG-UI agent from Angular's dependency injection container.
 * Use this in components or services provided via `provideAgent()` (or
 * `provideFakeAgent()`).
 *
 * Returns an `AgUiAgent` — the runtime-neutral `Agent` contract plus the
 * AG-UI-specific `customEvents` signal — so `customEvents` is reachable
 * directly, without casting.
 *
 * **Typed state via AgentRef.** Pass the same ref that was supplied to
 * `provideAgent(ref, …)` to carry the state type through DI without repeating
 * the generic at every call site. The no-arg form defaults to
 * `AgUiAgent<Record<string, unknown>>`.
 *
 * @example Typed state via AgentRef
 * ```ts
 * const agent = injectAgent(TRIP); // AgUiAgent<TripState>
 * ```
 */
export function injectAgent(): AgUiAgent;
export function injectAgent<T>(ref: AgentRef<T>): AgUiAgent<T>;
export function injectAgent<T>(ref?: AgentRef<T>): AgUiAgent<T> {
  return inject(ref ? ref.token : AGENT) as AgUiAgent<T>;
}
