// SPDX-License-Identifier: MIT
import type { Signal } from '@angular/core';
import type { ToolCall } from '../agent/tool-call';
import type { ClientToolSpec } from './to-json-schema';

/** The outcome of running a client tool. */
export type ClientToolResult =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly error: string };

/**
 * Optional Agent capability that lets the client declare tools to the model
 * and return their results. Implemented per-transport by each adapter
 * (AG-UI: native RunAgentInput.tools + addMessage/re-run; LangGraph: catalog
 * via run input + ToolMessage re-run).
 */
export interface ClientToolsCapability {
  /** Ship the client tool catalog to the model at run start. */
  setCatalog(specs: readonly ClientToolSpec[]): void;
  /** Tool calls the model made for client tools that await a client result. */
  readonly pending: Signal<readonly ToolCall[]>;
  /** Return a client tool's result (or error) and continue the run. */
  resolve(toolCallId: string, result: ClientToolResult): void;
}
