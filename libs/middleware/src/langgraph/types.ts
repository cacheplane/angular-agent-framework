// SPDX-License-Identifier: MIT
import type { BaseMessage } from '@langchain/core/messages';

/** A frontend-declared client tool: name + description + JSON-Schema parameters. */
export interface ClientToolSpec {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

/** The explicit OpenAI function-tool shape accepted by ChatModel.bindTools across versions. */
export interface OpenAIFunctionTool {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

/** The slice of graph state this middleware reads. */
export interface ClientToolsState {
  messages: BaseMessage[];
  /** Primary channel — AG-UI/LangGraph merges RunAgentInput.tools here. */
  tools?: ClientToolSpec[];
  /** Fallback channel — the raw run input key. */
  client_tools?: ClientToolSpec[];
}

export type { BaseMessage };
