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
    // getSubagents() hides 'pending' entries — this loop is empty when
    // correct, and bites only when a mutant wrongly establishes the match
    // and promotes a candidate to 'running'.
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

  it('empty-description attribution never exact-matches an empty stored description', () => {
    const t = new SubagentTracker();
    t.registerFromToolCalls([
      taskCall('call_a', { description: '' }),
      taskCall('call_b', { description: 'Book a flight' }),
    ]);
    // ensureToolStreamAttribution runs the ladder with '' — with two
    // candidates outstanding it must refuse (positional rung), not let
    // '' === '' claim call_a at the exact rung.
    t.ensureToolStreamAttribution('ns-uuid-7');
    t.addMessageToSubagent('ns-uuid-7', aiMsg('m1', 'child token'));
    // getSubagents() hides 'pending' entries — this loop is empty when
    // correct, and bites only when a mutant wrongly establishes the match
    // and promotes a candidate to 'running'.
    for (const subagent of t.getSubagents().values()) {
      expect(subagent.messages).toHaveLength(0);
    }
  });
});

describe('childStreamRefFromNamespace', () => {
  it('single tools: segment resolves to a tool child by tool-call id', () => {
    expect(childStreamRefFromNamespace(['tools:call-1'])).toEqual({
      key: 'call-1', name: '', kind: 'tool',
    });
  });

  it('a tool child followed by its own internal nodes stays a tool child', () => {
    // `model`/`agent` segments after the tools: segment are the child's own
    // graph internals, not a second delegation.
    expect(childStreamRefFromNamespace(['tools:call-1', 'agent:step-2'])).toEqual({
      key: 'call-1', name: '', kind: 'tool',
    });
  });

  it('plain subgraph namespace resolves to the first segment, named by node', () => {
    expect(childStreamRefFromNamespace(['research:uuid-1'])).toEqual({
      key: 'research:uuid-1', name: 'research', kind: 'subgraph',
    });
  });

  it('nested delegation registers as its own subgraph stream, never the outer tool child', () => {
    expect(childStreamRefFromNamespace(['tools:call-1', 'tools:call-2'])).toEqual({
      key: 'tools:call-1|tools:call-2', name: 'tools', kind: 'subgraph',
    });
  });

  it('nested delegation with intermediate segments still keys the full path', () => {
    expect(childStreamRefFromNamespace(['tools:call-1', 'agent:x', 'tools:call-2'])).toEqual({
      key: 'tools:call-1|agent:x|tools:call-2', name: 'tools', kind: 'subgraph',
    });
  });

  it('trailing internal segments after the innermost tools: segment do not fragment the key', () => {
    expect(childStreamRefFromNamespace(['tools:call-1', 'tools:call-2', 'agent:x'])).toEqual({
      key: 'tools:call-1|tools:call-2', name: 'tools', kind: 'subgraph',
    });
    expect(childStreamRefFromNamespace(['tools:call-1', 'tools:call-2', 'model:y'])).toEqual({
      key: 'tools:call-1|tools:call-2', name: 'tools', kind: 'subgraph',
    });
  });
});
