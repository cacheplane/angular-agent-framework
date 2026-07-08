// SPDX-License-Identifier: MIT
import { DestroyRef, effect, inject } from '@angular/core';
import type { Agent } from '../agent';
import type { ToolCall } from '../agent/tool-call';
import type { ClientToolRegistry, AnyFunctionToolDef } from './tool-def';
import type { ClientToolResult } from './client-tools-capability';
import { executeFunctionTool } from './execute';
import {
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
}

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

  const originalStop = agent.stop.bind(agent);
  agent.stop = async (): Promise<void> => {
    abortAll();
    await originalStop();
  };
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
  if (!executionGuard || !shouldClaimBeforeExecute(def)) {
    const result = await executeFunctionTool(def, rawArgs, { signal });
    if (!signal.aborted) settleToolCall(toolCall, result);
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
  if (signal.aborted) return;

  if (claim === 'claimed') {
    const result = await executeFunctionTool(def, rawArgs, { signal });
    if (signal.aborted) return;
    await recordOrResolveGuardFailure(
      executionGuard,
      key,
      result,
      toolCall,
      toolCallId,
      signal,
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
    signal,
    settleToolCall,
  );
}

async function recordOrResolveGuardFailure(
  executionGuard: ClientToolExecutionGuard,
  key: ClientToolExecutionKey,
  result: ClientToolResult,
  toolCall: ToolCall,
  toolCallId: string,
  signal: AbortSignal,
  settleToolCall: (toolCall: ToolCall, result: ClientToolResult) => void,
): Promise<void> {
  try {
    await executionGuard.store.record(key, result);
  } catch (err) {
    if (!signal.aborted) settleToolCall(toolCall, clientToolGuardFailureResult(toolCallId, err));
    return;
  }
  if (!signal.aborted) settleToolCall(toolCall, result);
}
