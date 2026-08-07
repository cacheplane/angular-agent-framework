// SPDX-License-Identifier: MIT
import { DestroyRef, effect, inject } from '@angular/core';
import type { Agent } from '../agent';
import type { ToolCall } from '../agent/tool-call';
import type { ClientToolRegistry, AnyFunctionToolDef } from './tool-def';
import type { ClientToolResult } from './client-tools-capability';
import { executeFunctionTool } from './execute';
import {
  cancelledClientToolResult,
  clientToolGuardFailureResult,
  defaultInterruptedClientToolResult,
  shouldClaimBeforeExecute,
  type ClientToolExecutionGuard,
  type ClientToolExecutionKey,
  type ClientToolExecutionRecord,
} from './client-tool-execution-guard';

/** Options for wiring automatic browser function-tool execution. */
export interface ClientToolExecutorOptions {
  readonly executionGuard?: ClientToolExecutionGuard;
  readonly settleToolCall?: (toolCall: ToolCall, result: ClientToolResult) => void;
  readonly shouldExecuteToolCall?: (toolCall: ToolCall) => boolean;
}

/** Live stop() patch per agent: every executor's abort, plus the original stop. */
interface AgentStopPatch {
  readonly aborts: Set<() => void>;
  readonly originalStop: Agent['stop'];
  readonly boundStop: () => Promise<void>;
}

/** Agents whose stop() this module has already wrapped. */
const patchedAgents = new WeakMap<Agent, AgentStopPatch>();

/**
 * Watches the agent's pending client tool calls and auto-runs FUNCTION tools,
 * resolving each with its result. View/ask (component) tools are handled by the
 * rendering layer, not here. No-op if the agent lacks the clientTools
 * capability. MUST be called in an injection context (sets up an effect).
 */
export function startClientToolExecutor(
  agent: Agent,
  registry: ClientToolRegistry,
  options: ClientToolExecutorOptions = {},
): void {
  const cap = agent.clientTools;
  if (!cap) return;
  const destroyRef = inject(DestroyRef);
  const inFlight = new Map<string, AbortController>();
  const abortAll = (): void => {
    for (const controller of inFlight.values()) {
      controller.abort();
    }
  };

  // The stop button lives in chat-input, which has no coordinator reference, so
  // wrapping agent.stop is the only interception seam. Wrap at most once per
  // agent, fan the stop out to EVERY live executor, and restore the original
  // once the last one is destroyed — agents often outlive the components that
  // start executors, so an unbounded stack of wrappers would leak.
  let patch = patchedAgents.get(agent);
  if (!patch) {
    const originalStop = agent.stop;
    const boundStop = originalStop.bind(agent);
    const aborts = new Set<() => void>();
    patch = { aborts, originalStop, boundStop };
    patchedAgents.set(agent, patch);
    agent.stop = async (): Promise<void> => {
      for (const abort of aborts) abort();
      await boundStop();
    };
  }
  const registration = patch;
  registration.aborts.add(abortAll);
  destroyRef.onDestroy(() => {
    registration.aborts.delete(abortAll);
    if (registration.aborts.size === 0 && patchedAgents.get(agent) === registration) {
      agent.stop = registration.originalStop;
      patchedAgents.delete(agent);
    }
  });
  destroyRef.onDestroy(abortAll);

  effect(() => {
    for (const tc of cap.pending()) {
      const def = registry[tc.name];
      if (!def || def.kind !== 'function') continue; // non-function handled elsewhere
      // NB: do NOT skip on `tc.status === 'complete'`. A client tool call is
      // marked 'complete' once its args finish streaming, yet it still has no
      // result and needs the browser to execute it. `pending` already excludes
      // calls that have a result or were resolved; `inFlight` prevents a
      // double-dispatch within a render cycle.
      if (inFlight.has(tc.id)) continue;
      if (options.shouldExecuteToolCall && !options.shouldExecuteToolCall(tc)) continue;
      const controller = new AbortController();
      inFlight.set(tc.id, controller);
      void runFunctionTool({
        def,
        toolCall: tc,
        rawArgs: tc.args,
        toolCallId: tc.id,
        controller,
        executionGuard: options.executionGuard,
        settleToolCall: options.settleToolCall ?? ((toolCall, result) => cap.resolve(toolCall.id, result)),
      }).finally(() => {
        inFlight.delete(tc.id);
      });
    }
  });
}

async function runFunctionTool(input: {
  readonly def: AnyFunctionToolDef;
  readonly toolCall: ToolCall;
  readonly rawArgs: unknown;
  readonly toolCallId: string;
  readonly controller: AbortController;
  readonly executionGuard?: ClientToolExecutionGuard;
  readonly settleToolCall: (toolCall: ToolCall, result: ClientToolResult) => void;
}): Promise<void> {
  const { def, toolCall, rawArgs, toolCallId, controller, executionGuard, settleToolCall } = input;
  const signal = controller.signal;
  // An aborted call MUST still settle: leaving it unsettled keeps it out of
  // `resolvedIds`, so it stays pending and is re-dispatched after the next run
  // (re-running a side-effecting handler the user explicitly stopped) and
  // leaves the server thread holding a tool call with no tool result.
  if (!executionGuard || !shouldClaimBeforeExecute(def)) {
    const result = await executeFunctionTool(def, rawArgs, { signal });
    settleToolCall(toolCall, signal.aborted ? cancelledClientToolResult(toolCallId) : result);
    return;
  }

  const key = { threadId: executionGuard.threadId, toolCallId };
  let claim: 'claimed' | ClientToolExecutionRecord;
  try {
    claim = await executionGuard.store.claim(key);
  } catch (err) {
    if (!signal.aborted) settleToolCall(toolCall, clientToolGuardFailureResult(toolCallId, err));
    return;
  }
  if (signal.aborted) {
    settleToolCall(toolCall, cancelledClientToolResult(toolCallId));
    return;
  }

  if (claim === 'claimed') {
    const result = await executeFunctionTool(def, rawArgs, { signal });
    const finalResult = signal.aborted ? cancelledClientToolResult(toolCallId) : result;
    await recordOrResolveGuardFailure(
      executionGuard,
      key,
      finalResult,
      toolCall,
      toolCallId,
      settleToolCall,
    );
    return;
  }

  if (claim.status === 'done') {
    settleToolCall(toolCall, claim.result);
    return;
  }

  const result = claim.status === 'failed' && claim.result
    ? claim.result
    : defaultInterruptedClientToolResult(toolCallId);
  await recordOrResolveGuardFailure(
    executionGuard,
    key,
    result,
    toolCall,
    toolCallId,
    settleToolCall,
  );
}

/**
 * Record the final result then settle. Deliberately abort-agnostic: an aborted
 * execution must still write its (cancelled) result, otherwise the guard store
 * stays at `executing` forever and a later reload fails closed with a
 * misleading "interrupted" message.
 */
async function recordOrResolveGuardFailure(
  executionGuard: ClientToolExecutionGuard,
  key: ClientToolExecutionKey,
  result: ClientToolResult,
  toolCall: ToolCall,
  toolCallId: string,
  settleToolCall: (toolCall: ToolCall, result: ClientToolResult) => void,
): Promise<void> {
  try {
    await executionGuard.store.record(key, result);
  } catch (err) {
    settleToolCall(toolCall, clientToolGuardFailureResult(toolCallId, err));
    return;
  }
  settleToolCall(toolCall, result);
}
