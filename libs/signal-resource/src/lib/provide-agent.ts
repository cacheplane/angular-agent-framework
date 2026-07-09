// SPDX-License-Identifier: MIT
import { InjectionToken, inject, type Provider } from '@angular/core';
import type { Agent, AgentRef } from '@threadplane/chat';
import { toAgent, type SignalChatResourceLike } from './to-agent';

/** Resource instance or factory accepted by `provideAgent()`. */
export type SignalResourceAgentSource =
  | SignalChatResourceLike
  | (() => SignalChatResourceLike);

/**
 * @internal — exported for spec access only. Consumers should use injectAgent().
 */
export const AGENT = new InjectionToken<Agent>('SIGNAL_RESOURCE_AGENT');

function resolveSource(sourceOrFactory: SignalResourceAgentSource): SignalChatResourceLike {
  return typeof sourceOrFactory === 'function' ? sourceOrFactory() : sourceOrFactory;
}

function buildAgent(sourceOrFactory: SignalResourceAgentSource): Agent {
  return toAgent(resolveSource(sourceOrFactory));
}

function isAgentRef<T>(x: unknown): x is AgentRef<T> {
  return typeof x === 'object' && x !== null && 'token' in x;
}

/**
 * Provides a signal-resource-backed Agent through Angular dependency injection.
 *
 * @example
 * ```ts
 * import { provideAgent } from '@threadplane/signal-resource';
 *
 * bootstrapApplication(AppComponent, {
 *   providers: [provideAgent(() => resource)],
 * });
 * ```
 */
export function provideAgent<T = Record<string, unknown>>(
  ref: AgentRef<T>,
  sourceOrFactory: SignalResourceAgentSource,
): Provider[];
export function provideAgent(sourceOrFactory: SignalResourceAgentSource): Provider[];
export function provideAgent<T = Record<string, unknown>>(
  refOrSource: AgentRef<T> | SignalResourceAgentSource,
  maybeSource?: SignalResourceAgentSource,
): Provider[] {
  const ref = isAgentRef<T>(refOrSource) ? refOrSource : undefined;
  const sourceOrFactory = (ref ? maybeSource : refOrSource) as SignalResourceAgentSource;

  const providers: Provider[] = [
    { provide: AGENT, useFactory: () => buildAgent(sourceOrFactory) },
  ];
  if (ref) providers.push({ provide: ref.token, useExisting: AGENT });
  return providers;
}

/**
 * Injects the signal-resource-backed Agent registered by provideAgent().
 *
 * @example
 * ```ts
 * import { injectAgent } from '@threadplane/signal-resource';
 *
 * const agent = injectAgent();
 * ```
 */
export function injectAgent(): Agent;
export function injectAgent<T>(ref: AgentRef<T>): Agent<T>;
export function injectAgent<T>(ref?: AgentRef<T>): Agent<T> {
  return inject(ref ? ref.token : AGENT) as Agent<T>;
}
