// SPDX-License-Identifier: MIT
import type { BaseMessage } from '@langchain/core/messages';

export interface TrackedToolCall {
  id?: string;
  name: string;
  args: Record<string, unknown> | string;
}

export interface TrackedSubagent {
  id: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  toolCall: {
    id: string;
    name: string;
    args: Record<string, unknown>;
  };
  values: Record<string, unknown>;
  messages: BaseMessage[];
}

export interface SubagentTrackerOptions {
  subagentToolNames?: string[];
  onSubagentChange?: () => void;
}

const DEFAULT_SUBAGENT_TOOL_NAMES = ['task'];

/**
 * Lightweight Angular adapter for LangGraph subagent stream state.
 *
 * This intentionally mirrors only the SDK behavior this package exposes. Using
 * the SDK UI barrel at runtime pulls StreamManager/client utilities into every
 * Angular bundle, which breaks cockpit production budgets.
 */
export class SubagentTracker {
  private readonly subagentToolNames: Set<string>;
  private readonly onSubagentChange?: () => void;
  private readonly subagents = new Map<string, TrackedSubagent>();
  private readonly namespaceToToolCallId = new Map<string, string>();
  private readonly pendingMatches = new Map<string, string>();

  constructor(options: SubagentTrackerOptions = {}) {
    this.subagentToolNames = new Set(options.subagentToolNames ?? DEFAULT_SUBAGENT_TOOL_NAMES);
    this.onSubagentChange = options.onSubagentChange;
  }

  clear(): void {
    this.subagents.clear();
    this.namespaceToToolCallId.clear();
    this.pendingMatches.clear();
    this.onSubagentChange?.();
  }

  getSubagents(): Map<string, TrackedSubagent> {
    const visible = new Map<string, TrackedSubagent>();
    for (const [id, subagent] of this.subagents) {
      if (subagent.status !== 'pending') {
        visible.set(id, subagent);
      }
    }
    return visible;
  }

  registerFromToolCalls(toolCalls: TrackedToolCall[], aiMessageId?: string | null): void {
    let changed = false;
    for (const toolCall of toolCalls) {
      if (!this.subagentToolNames.has(toolCall.name)) continue;

      const id = toolCall.id;
      if (!id) continue;

      const args = parseToolCallArgs(toolCall.args);
      if (!isValidSubagentType(args['subagent_type'])) continue;

      const existing = this.subagents.get(id);
      this.subagents.set(id, {
        id,
        status: existing?.status ?? 'pending',
        toolCall: {
          id,
          name: toolCall.name,
          args: {
            ...args,
            ...(aiMessageId ? { _aiMessageId: aiMessageId } : {}),
          },
        },
        values: existing?.values ?? {},
        messages: existing?.messages ?? [],
      });
      changed = true;
    }

    if (changed) {
      this.retryPendingMatches();
      this.onSubagentChange?.();
    }
  }

  reconstructFromMessages(messages: BaseMessage[], options: { skipIfPopulated?: boolean } = {}): void {
    if (options.skipIfPopulated && this.subagents.size > 0) return;

    for (const message of messages) {
      const raw = message as unknown as Record<string, unknown>;
      if (isAiMessageWithToolCalls(raw)) {
        this.registerFromToolCalls(
          raw['tool_calls'] as TrackedToolCall[],
          typeof raw['id'] === 'string' ? raw['id'] : null,
        );
      } else if (isToolMessage(raw)) {
        this.processToolMessage(raw['tool_call_id'], raw['content'], raw['status'] === 'error' ? 'error' : 'success');
      }
    }
  }

  matchSubgraphToSubagent(namespaceId: string, description: string): string | undefined {
    if (this.namespaceToToolCallId.has(namespaceId)) {
      return this.namespaceToToolCallId.get(namespaceId);
    }

    const mapped = new Set(this.namespaceToToolCallId.values());
    const establish = (toolCallId: string): string => {
      this.namespaceToToolCallId.set(namespaceId, toolCallId);
      const subagent = this.subagents.get(toolCallId);
      if (subagent) {
        this.subagents.set(toolCallId, {
          ...subagent,
          status: subagent.status === 'complete' || subagent.status === 'error' ? subagent.status : 'running',
        });
      }
      this.onSubagentChange?.();
      return toolCallId;
    };

    for (const [toolCallId, subagent] of this.subagents) {
      if (mapped.has(toolCallId)) continue;
      if (subagent.toolCall.args['description'] === description) {
        return establish(toolCallId);
      }
    }

    for (const [toolCallId, subagent] of this.subagents) {
      if (mapped.has(toolCallId)) continue;
      const subagentDescription = subagent.toolCall.args['description'];
      if (typeof subagentDescription !== 'string' || !subagentDescription) continue;
      if (description.includes(subagentDescription) || subagentDescription.includes(description)) {
        return establish(toolCallId);
      }
    }

    for (const [toolCallId, subagent] of this.subagents) {
      if (!mapped.has(toolCallId) && (subagent.status === 'pending' || subagent.status === 'running')) {
        return establish(toolCallId);
      }
    }

    if (description) {
      this.pendingMatches.set(namespaceId, description);
    }
    return undefined;
  }

  markRunningFromNamespace(namespaceId: string, namespace?: string[]): void {
    const toolCallId = this.resolveToolCallId(namespaceId);
    const subagent = this.subagents.get(toolCallId);
    if (!subagent) return;

    if (!this.namespaceToToolCallId.has(namespaceId)) {
      this.namespaceToToolCallId.set(namespaceId, toolCallId);
    }
    this.subagents.set(toolCallId, {
      ...subagent,
      status: subagent.status === 'complete' || subagent.status === 'error' ? subagent.status : 'running',
      values: {
        ...subagent.values,
        ...(namespace ? { namespace } : {}),
      },
    });
    this.onSubagentChange?.();
  }

  updateSubagentValues(namespaceId: string, values: Record<string, unknown>): void {
    const toolCallId = this.resolveToolCallId(namespaceId);
    const subagent = this.subagents.get(toolCallId);
    if (!subagent) return;

    this.subagents.set(toolCallId, {
      ...subagent,
      status: subagent.status === 'complete' || subagent.status === 'error' ? subagent.status : 'running',
      values,
    });
    this.onSubagentChange?.();
  }

  addMessageToSubagent(namespaceId: string, message: BaseMessage): void {
    const toolCallId = this.resolveToolCallId(namespaceId);
    const subagent = this.subagents.get(toolCallId);
    if (!subagent) return;

    this.subagents.set(toolCallId, {
      ...subagent,
      status: subagent.status === 'complete' || subagent.status === 'error' ? subagent.status : 'running',
      messages: mergeMessages(subagent.messages, [message]),
    });
    this.onSubagentChange?.();
  }

  processToolMessage(toolCallId: string, content: unknown, status: 'success' | 'error'): void {
    const subagent = this.subagents.get(toolCallId);
    if (!subagent) return;

    this.subagents.set(toolCallId, {
      ...subagent,
      status: status === 'error' ? 'error' : 'complete',
      values: {
        ...subagent.values,
        result: content,
      },
    });
    this.onSubagentChange?.();
  }

  private retryPendingMatches(): void {
    for (const [namespaceId, description] of this.pendingMatches) {
      if (this.matchSubgraphToSubagent(namespaceId, description)) {
        this.pendingMatches.delete(namespaceId);
      }
    }
  }

  private resolveToolCallId(namespaceId: string): string {
    return this.namespaceToToolCallId.get(namespaceId) ?? namespaceId;
  }
}

export function isSubagentNamespace(namespace: string[] | string | undefined): boolean {
  if (!namespace) return false;
  if (typeof namespace === 'string') return namespace.includes('tools:');
  return namespace.some(segment => segment.startsWith('tools:'));
}

export function extractToolCallIdFromNamespace(namespace: string[] | undefined): string | undefined {
  if (!namespace) return undefined;
  for (const segment of namespace) {
    if (segment.startsWith('tools:')) return segment.slice(6);
  }
  return undefined;
}

function parseToolCallArgs(args: Record<string, unknown> | string): Record<string, unknown> {
  if (typeof args !== 'string') return args;
  try {
    const parsed = JSON.parse(args) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function isValidSubagentType(value: unknown): value is string {
  return typeof value === 'string'
    && value.length >= 3
    && value.length <= 50
    && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(value);
}

function isAiMessageWithToolCalls(value: Record<string, unknown>): boolean {
  return (value['type'] === 'ai' || value['type'] === 'assistant')
    && Array.isArray(value['tool_calls']);
}

function isToolMessage(value: Record<string, unknown>): value is Record<string, unknown> & { tool_call_id: string } {
  return value['type'] === 'tool' && typeof value['tool_call_id'] === 'string';
}

function mergeMessages(existing: BaseMessage[], incoming: BaseMessage[]): BaseMessage[] {
  const merged = [...existing];
  for (const msg of incoming) {
    const id = getMessageId(msg);
    const idx = id ? merged.findIndex(m => getMessageId(m) === id) : -1;
    if (idx >= 0) {
      merged[idx] = msg;
    } else {
      merged.push(msg);
    }
  }
  return merged;
}

function getMessageId(message: BaseMessage): string | undefined {
  return (message as unknown as { id?: string }).id;
}
