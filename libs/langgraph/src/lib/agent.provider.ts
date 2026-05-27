// SPDX-License-Identifier: MIT
import { InjectionToken, type Provider, type Signal } from '@angular/core';
import type { BaseMessage } from '@langchain/core/messages';
import type { BagTemplate } from '@langchain/langgraph-sdk';
import type { AgentRuntimeTelemetrySink } from '@threadplane/chat';
import { agent } from './agent.fn';
import type {
  AgentTransport,
  LangGraphAgent,
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
  /** Optional app-owned telemetry sink. No telemetry is emitted unless this is provided. */
  telemetry?: AgentRuntimeTelemetrySink | false;
  /** When true, subagent messages are filtered from the main messages signal. */
  filterSubagentMessages?: boolean;
  /** Tool names that indicate a subagent invocation. */
  subagentToolNames?: string[];
}

export const AGENT_CONFIG = new InjectionToken<AgentConfig>('AGENT_CONFIG');

/**
 * @internal — exported for spec access only. Consumers must use `injectAgent()`.
 */
export const AGENT = new InjectionToken<LangGraphAgent>('AGENT');

/**
 * Angular provider factory that registers a singleton agent instance
 * (under the internal `AGENT` token) and exposes the same config under
 * `AGENT_CONFIG` for the legacy `agent({...})` factory's global-default lookup.
 *
 * To use a different agent in a component subtree, re-provide
 * `provideAgent({...})` in that component's `providers: []` array —
 * Angular's hierarchical DI scopes the singleton accordingly.
 */
export function provideAgent<T = Record<string, unknown>>(
  config: AgentConfig<T>,
): Provider[] {
  return [
    // Keep AGENT_CONFIG functional so the legacy agent({...}) factory still
    // reads its global defaults from it. Removed in Task A1c, when the legacy
    // `agent({...})` factory is deleted; AGENT_CONFIG and this provider line
    // go away with it.
    // See docs/superpowers/plans/2026-05-27-agent-to-langgraph-rename.md.
    { provide: AGENT_CONFIG, useValue: config },
    {
      provide: AGENT,
      useFactory: () => {
        // useFactory runs in an injection context, so the legacy `agent()`
        // factory's `inject(DestroyRef)` / `inject(AGENT_CONFIG)` calls work.
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
          ...(config.telemetry !== undefined ? { telemetry: config.telemetry } : {}),
          ...(config.filterSubagentMessages !== undefined ? { filterSubagentMessages: config.filterSubagentMessages } : {}),
          ...(config.subagentToolNames !== undefined ? { subagentToolNames: config.subagentToolNames } : {}),
        });
      },
    },
  ];
}
