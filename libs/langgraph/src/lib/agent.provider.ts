// SPDX-License-Identifier: MIT
import { InjectionToken, inject, type Provider, type Signal } from '@angular/core';
import type { BaseMessage } from '@langchain/core/messages';
import type { BagTemplate } from '@langchain/langgraph-sdk';
import type { AgentRuntimeTelemetrySink } from '@threadplane/chat';
import { agent } from './agent.fn';
import type {
  AgentTransport,
  LangGraphAgent,
  LangGraphClientOptions,
} from './agent.types';

/**
 * Configuration for an agent instance.
 * Combines connection defaults with per-component options so the
 * agent can be constructed once at provider time and injected
 * everywhere it is needed.
 */
// The second generic mirrors AgentOptions so consumers can pin a Bag
// template; it is currently unused inside this shape.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface AgentConfig<
  T = Record<string, unknown>,
  _Bag extends BagTemplate = BagTemplate,
> {
  /** Base URL of the LangGraph Platform API (e.g., `'http://localhost:2024'`). */
  apiUrl?: string;
  /** Agent or graph identifier on the LangGraph platform. */
  assistantId?: string;
  /** Thread ID to connect to. Pass a Signal for reactive thread switching. */
  threadId?: Signal<string | null> | string | null;
  /** Called when a new thread is auto-created by the transport. */
  onThreadId?: (id: string) => void;
  /** Initial state values before the first stream response arrives. */
  initialValues?: Partial<T>;
  /** Throttle signal updates in milliseconds. `false` to disable. */
  throttle?: number | false;
  /** Custom message deserializer for non-standard message formats. */
  toMessage?: (msg: unknown) => BaseMessage;
  /** Custom transport. Defaults to {@link FetchStreamTransport}. */
  transport?: AgentTransport;
  /** Tuning options for the default transport's LangGraph SDK client (e.g. retry budget). */
  clientOptions?: LangGraphClientOptions;
  /** Optional app-owned telemetry sink. No telemetry is emitted unless this is provided. */
  telemetry?: AgentRuntimeTelemetrySink | false;
  /** When true, subagent messages are filtered from the main messages signal. */
  filterSubagentMessages?: boolean;
  /** Tool names that indicate a subagent invocation. */
  subagentToolNames?: string[];
}

/**
 * @internal — exported only so the legacy in-tree `agent({...})` factory (and
 * its tests) can read provider-supplied defaults. Not part of the public API;
 * consumers should construct config inline at `provideAgent({...})`.
 */
export const AGENT_CONFIG = new InjectionToken<AgentConfig>('AGENT_CONFIG');

/**
 * @internal — exported for spec access only. Consumers must use `injectAgent()`.
 */
export const AGENT = new InjectionToken<LangGraphAgent>('AGENT');

/**
 * Wire the LangGraph adapter into Angular's dependency injection.
 *
 * Registers a singleton `LangGraphAgent` constructed from `config`. Retrieve it
 * in any component with `injectAgent()`. Provide this at the application root
 * (`app.config.ts`) for an app-wide agent.
 *
 * To use a different agent in a component subtree, re-provide
 * `provideAgent({...})` in that component's `providers: []` array —
 * Angular's hierarchical DI scopes the singleton accordingly.
 *
 * **Static vs factory config.** Pass a plain `AgentConfig` object when the
 * config is known up front. Pass a `() => AgentConfig` factory when the config
 * depends on runtime/DI state — the factory runs inside an Angular injection
 * context, so it may call `inject()` to read services, route params, or
 * component-scoped signals:
 *
 * ```ts
 * providers: [
 *   provideAgent(() => {
 *     const route = inject(ActivatedRoute);
 *     return { assistantId: 'chat', threadId: toSignal(route.paramMap) };
 *   }),
 * ];
 * ```
 */
export function provideAgent<T = Record<string, unknown>>(
  configOrFactory: AgentConfig<T> | (() => AgentConfig<T>),
): Provider[] {
  // Resolve the factory (if any) lazily, inside the injection context of the
  // AGENT_CONFIG useFactory below — never at decoration time.
  const resolveConfig = (): AgentConfig<T> =>
    typeof configOrFactory === 'function' ? configOrFactory() : configOrFactory;

  return [
    // AGENT_CONFIG resolves the config once (running the factory in an
    // injection context if a factory was passed). AGENT reads the resolved
    // config from here, so the factory is invoked exactly once.
    { provide: AGENT_CONFIG, useFactory: resolveConfig },
    {
      provide: AGENT,
      useFactory: () => {
        // useFactory runs in an injection context, so the legacy `agent()`
        // factory's `inject(DestroyRef)` calls work.
        const config = inject(AGENT_CONFIG) as AgentConfig<T>;
        if (config.assistantId === undefined) {
          throw new Error(
            'provideAgent: `assistantId` is required to construct the AGENT singleton.',
          );
        }
        return agent<T>({
          assistantId: config.assistantId,
          ...(config.apiUrl !== undefined ? { apiUrl: config.apiUrl } : {}),
          ...(config.threadId !== undefined ? { threadId: config.threadId } : {}),
          ...(config.onThreadId !== undefined ? { onThreadId: config.onThreadId } : {}),
          ...(config.initialValues !== undefined ? { initialValues: config.initialValues } : {}),
          ...(config.throttle !== undefined ? { throttle: config.throttle } : {}),
          ...(config.toMessage !== undefined ? { toMessage: config.toMessage } : {}),
          ...(config.transport !== undefined ? { transport: config.transport } : {}),
          ...(config.clientOptions !== undefined ? { clientOptions: config.clientOptions } : {}),
          ...(config.telemetry !== undefined ? { telemetry: config.telemetry } : {}),
          ...(config.filterSubagentMessages !== undefined ? { filterSubagentMessages: config.filterSubagentMessages } : {}),
          ...(config.subagentToolNames !== undefined ? { subagentToolNames: config.subagentToolNames } : {}),
        });
      },
    },
  ];
}
