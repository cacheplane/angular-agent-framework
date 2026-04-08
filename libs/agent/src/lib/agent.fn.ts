// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  inject, DestroyRef, computed,
  isSignal, Signal,
} from '@angular/core';
import { AGENT_CONFIG } from './agent.provider';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject, Subject, of,
  throttleTime, asyncScheduler,
} from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import type { BaseMessage } from '@langchain/core/messages';
import type { Interrupt } from '@langchain/langgraph-sdk';
import type { BagTemplate, InferBag } from '@langchain/langgraph-sdk';

import {
  AgentOptions,
  AgentRef,
  StreamSubjects,
  SubagentStreamRef,
  ResourceStatus,
} from './agent.types';
import type { ThreadState, ToolProgress, ToolCallWithResult } from '@langchain/langgraph-sdk';
import { createStreamManagerBridge } from './internals/stream-manager.bridge';

/**
 * Creates a streaming resource connected to a LangGraph agent.
 *
 * Must be called within an Angular injection context (component constructor,
 * field initializer, or `runInInjectionContext`). Returns a ref object whose
 * properties are Angular Signals that update in real-time as the agent streams.
 *
 * @typeParam T - The state shape returned by the agent (e.g., `{ messages: BaseMessage[] }`)
 * @typeParam Bag - Optional bag template for typed interrupts and submit payloads
 * @param options - Configuration for the streaming resource
 * @returns A {@link AgentRef} with reactive signals and action methods
 *
 * @example
 * ```typescript
 * // In a component field initializer
 * const chat = agent<{ messages: BaseMessage[] }>({
 *   assistantId: 'chat_agent',
 *   apiUrl: 'http://localhost:2024',
 *   threadId: signal(this.savedThreadId),
 *   onThreadId: (id) => localStorage.setItem('threadId', id),
 * });
 *
 * // Access signals in template
 * // chat.messages(), chat.status(), chat.error()
 * ```
 */
export function agent<
  T = Record<string, unknown>,
  Bag extends BagTemplate = BagTemplate,
>(
  options: AgentOptions<T, InferBag<T, Bag>>,
): AgentRef<T, InferBag<T, Bag>> {
  // Injection context required
  const destroyRef   = inject(DestroyRef);
  const globalConfig = inject(AGENT_CONFIG, { optional: true });
  const destroy$     = new Subject<void>();
  destroyRef.onDestroy(() => { destroy$.next(); destroy$.complete(); });

  // Merge: call-site options take precedence over global provider config
  const apiUrl    = options.apiUrl    ?? globalConfig?.apiUrl    ?? '';
  const transport = options.transport ?? globalConfig?.transport;

  const init = (options.initialValues ?? {}) as T;

  // All subjects created before the bridge
  const status$          = new BehaviorSubject<ResourceStatus>(ResourceStatus.Idle);
  const values$          = new BehaviorSubject<T>(init);
  const messages$        = new BehaviorSubject<BaseMessage[]>([]);
  const error$           = new BehaviorSubject<unknown>(undefined);
  const interrupt$       = new BehaviorSubject<Interrupt<InferBag<T, Bag>['InterruptType']> | undefined>(undefined);
  const interrupts$      = new BehaviorSubject<Interrupt<InferBag<T, Bag>['InterruptType']>[]>([]);
  const branch$          = new BehaviorSubject<string>('');
  const history$         = new BehaviorSubject<ThreadState<T>[]>([]);
  const isThreadLoading$ = new BehaviorSubject<boolean>(false);
  const toolProgress$    = new BehaviorSubject<ToolProgress[]>([]);
  const toolCalls$       = new BehaviorSubject<ToolCallWithResult[]>([]);
  const subagents$       = new BehaviorSubject<Map<string, SubagentStreamRef>>(new Map());
  const hasValue$        = new BehaviorSubject<boolean>(false);

  function resetDerivedThreadState(): void {
    status$.next(ResourceStatus.Idle);
    error$.next(undefined);
    hasValue$.next(false);
  }

  // Track hasValue — becomes true once values or messages arrive
  values$.pipe(takeUntil(destroy$)).subscribe(v => {
    if (v != null && Object.keys(v as object).length > 0) hasValue$.next(true);
  });
  messages$.pipe(takeUntil(destroy$)).subscribe(m => { if (m.length > 0) hasValue$.next(true); });

  const subjects: StreamSubjects<T, InferBag<T, Bag>> = {
    status$, values$, messages$, error$,
    interrupt$, interrupts$, branch$, history$,
    isThreadLoading$, toolProgress$, toolCalls$, subagents$,
  };

  // threadId$ — resolved before bridge creation (injection context required for toObservable)
  const threadId$ = isSignal(options.threadId)
    ? toObservable(options.threadId as Signal<string | null>)
    : of((options.threadId as string | null | undefined) ?? null);

  let hasSeenThreadId = false;
  let lastThreadId: string | null = null;
  threadId$.pipe(takeUntil(destroy$)).subscribe((id) => {
    if (hasSeenThreadId && lastThreadId !== id) {
      resetDerivedThreadState();
    }
    hasSeenThreadId = true;
    lastThreadId = id;
  });

  const manager = createStreamManagerBridge({
    options: { ...options, apiUrl, transport },
    subjects,
    threadId$,
    destroy$: destroy$.asObservable(),
  });

  // Throttle helper
  const ms = typeof options.throttle === 'number' ? options.throttle : 0;
  const maybeThrottle = <V>(obs: BehaviorSubject<V>) =>
    ms > 0
      ? obs.pipe(throttleTime(ms, asyncScheduler, { leading: true, trailing: true }))
      : obs.asObservable();

  // Convert to Angular Signals (must happen in injection context)
  const value        = toSignal(maybeThrottle(values$),   { initialValue: init });
  const messages     = toSignal(maybeThrottle(messages$), { initialValue: [] as BaseMessage[] });
  const statusSig    = toSignal(status$,          { initialValue: ResourceStatus.Idle });
  const errorSig     = toSignal(error$,           { initialValue: undefined as unknown });
  const hasValueSig  = toSignal(hasValue$,        { initialValue: false });
  const interruptSig = toSignal(interrupt$,       { initialValue: undefined });
  const interruptsSig= toSignal(interrupts$,      { initialValue: [] });
  const branchSig    = toSignal(branch$,          { initialValue: '' });
  const historySig   = toSignal(history$,         { initialValue: [] });
  const threadLoadSig= toSignal(isThreadLoading$, { initialValue: false });
  const toolProgSig  = toSignal(toolProgress$,    { initialValue: [] });
  const toolCallsSig = toSignal(toolCalls$,       { initialValue: [] });
  const subagentsSig = toSignal(subagents$,       { initialValue: new Map<string, SubagentStreamRef>() });

  const isLoading    = computed(() => statusSig() === ResourceStatus.Loading);
  const activeSubagents = computed(() =>
    [...subagentsSig().values()].filter(s => s.status() === 'running')
  );

  return {
    // ResourceRef compatible
    value:    value as Signal<T>,
    status:   statusSig,
    isLoading,
    error:    errorSig,
    hasValue: hasValueSig,
    reload:   () => manager.resubmitLast(),

    // Streaming state
    messages:        messages as Signal<BaseMessage[]>,
    interrupt:       interruptSig,
    interrupts:      interruptsSig,
    toolProgress:    toolProgSig,
    toolCalls:       toolCallsSig,

    // Thread & history
    branch:          branchSig,
    history:         historySig,
    isThreadLoading: threadLoadSig,

    // Subagents
    subagents:       subagentsSig,
    activeSubagents,

    // Actions
    // submit() fires the stream in the background and resolves immediately
    submit: (vals, opts) => {
      manager.submit(vals, opts);
      return Promise.resolve();
    },
    stop:         ()           => manager.stop(),
    switchThread: (id)         => {
      resetDerivedThreadState();
      manager.switchThread(id);
    },
    joinStream:   (id, last)   => manager.joinStream(id, last),
    setBranch:    (b)          => branch$.next(b),
    // V1 deferred: requires StreamManager's internal message registry
    getMessagesMetadata: (_msg, _idx) => undefined,
    getToolCalls: (_msg) => [],
  };
}
