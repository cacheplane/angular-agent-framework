// SPDX-License-Identifier: MIT
//
// Direct unit coverage for the subagent attribution ladder. The tracker is a
// plain class, so these tests drive it without the stream-manager bridge.
// Reaching rungs 1/2 THROUGH the bridge additionally requires the child's
// `values` event (carrying a human first message) to arrive before any child
// `messages` event — an ordering no bridge test encodes, which is why ladder
// coverage lives here instead.
import { describe, it, expect } from 'vitest';
import type { BaseMessage } from '@langchain/core/messages';
import { SubagentTracker, childStreamRefFromNamespace } from './subagent-tracker';

function taskCall(id: string, args: Record<string, unknown>) {
  return { id, name: 'task', args: { subagent_type: 'researcher', ...args } };
}

function aiMsg(id: string, content: string): BaseMessage {
  return { id, type: 'ai', content } as unknown as BaseMessage;
}

describe('SubagentTracker attribution ladder', () => {
  it('rung 1: exact description match wins even with multiple candidates', () => {
    const t = new SubagentTracker();
    t.registerFromToolCalls([
      taskCall('call_a', { description: 'Summarize the meeting notes' }),
      taskCall('call_b', { description: 'Research quantum signals' }),
    ]);
    // Namespace id is an internal UUID — deliberately NOT a tool-call id, so
    // nothing but the ladder can resolve it. Two candidates outstanding, so
    // the positional rung would refuse; only the exact rung can attribute.
    const winner = t.matchSubgraphToSubagent('ns-uuid-1', 'Research quantum signals');
    expect(winner).toBe('call_b');
  });

  it('rung 2: substring match (either direction) wins when exact fails', () => {
    const t = new SubagentTracker();
    t.registerFromToolCalls([
      taskCall('call_a', { description: 'Summarize the meeting notes' }),
      taskCall('call_b', { description: 'Research quantum signals' }),
    ]);
    // The child's first human message elaborates on the stored description.
    const winner = t.matchSubgraphToSubagent(
      'ns-uuid-2',
      'Research quantum signals across the 2025 arxiv corpus',
    );
    expect(winner).toBe('call_b');
  });

  it('rung 2: an empty stored description is never a substring match', () => {
    const t = new SubagentTracker();
    t.registerFromToolCalls([
      taskCall('call_a', { description: '' }),
      taskCall('call_b', { description: 'Book a flight' }),
    ]);
    // 'anything' contains '' — without the guard at the substring rung,
    // call_a would claim every stream. It must not.
    const winner = t.matchSubgraphToSubagent('ns-uuid-3', 'anything unrelated');
    expect(winner).toBeUndefined();
  });

  it('rung 3: positional fallback attributes only when exactly one candidate is outstanding', () => {
    const t = new SubagentTracker();
    t.registerFromToolCalls([taskCall('call_solo', { task_description: 'x' })]);
    expect(t.matchSubgraphToSubagent('ns-uuid-4', '')).toBe('call_solo');
  });

  it('rung 3: refuses with two outstanding candidates and buffers instead', () => {
    const t = new SubagentTracker();
    t.registerFromToolCalls([
      taskCall('call_a', { task_description: 'x' }),
      taskCall('call_b', { task_description: 'y' }),
    ]);
    expect(t.matchSubgraphToSubagent('ns-uuid-5', '')).toBeUndefined();

    // Unattributed messages are held, not dropped and not mis-assigned.
    t.addMessageToSubagent('ns-uuid-5', aiMsg('m1', 'early chunk'));
    for (const subagent of t.getSubagents().values()) {
      expect(subagent.messages).toHaveLength(0);
    }
  });

  it('deferred retry: a pending match resolves when the tool call registers later', () => {
    const t = new SubagentTracker();
    // Child stream arrives BEFORE the parent's tool call — nothing to match yet.
    expect(t.matchSubgraphToSubagent('ns-uuid-6', 'Find flights to Lisbon')).toBeUndefined();
    t.addMessageToSubagent('ns-uuid-6', aiMsg('m1', 'checking fares'));

    // Parent tool call registers; registerFromToolCalls drains pendingMatches.
    t.registerFromToolCalls([taskCall('call_late', { description: 'Find flights to Lisbon' })]);

    const subagent = t.getSubagents().get('call_late');
    expect(subagent?.status).toBe('running');
    expect(subagent?.messages).toEqual([
      expect.objectContaining({ id: 'm1', content: 'checking fares' }),
    ]);
  });
});
