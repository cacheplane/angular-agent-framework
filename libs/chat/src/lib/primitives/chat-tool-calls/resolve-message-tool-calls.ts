// SPDX-License-Identifier: MIT
import type { Agent, Message, ToolCall } from '../../agent';

/**
 * Resolves the tool calls that belong to a specific message, mirroring the
 * per-message scoping the chat lib uses to avoid every assistant bubble
 * re-rendering the whole thread's tool-call list.
 *
 * - No message context → the agent's global tool-call list.
 * - Assistant message with `toolCallIds` (LangGraph) → those ids, in order.
 * - Assistant message with `tool_use` content blocks (Anthropic) → those ids.
 * - Assistant message with no linkage → [] (this message emitted no calls).
 * - Any non-assistant message → the global list (callers filter as needed).
 *
 * MUST be called inside a reactive context (computed/effect) so the
 * `agent.toolCalls()` signal read registers a dependency.
 */
export function resolveMessageToolCalls(agent: Agent, message: Message | undefined): ToolCall[] {
  const all = agent.toolCalls();
  if (message && message.role === 'assistant') {
    if (message.toolCallIds && message.toolCallIds.length > 0) {
      return message.toolCallIds
        .map((id) => all.find((tc) => tc.id === id))
        .filter((x): x is ToolCall => !!x);
    }
    if (Array.isArray(message.content)) {
      const blocks = message.content.filter((b) => b.type === 'tool_use');
      return blocks
        .map((b) => all.find((tc) => tc.id === b.id))
        .filter((x): x is ToolCall => !!x);
    }
    return [];
  }
  return all;
}
