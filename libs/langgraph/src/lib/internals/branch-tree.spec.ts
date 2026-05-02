import { describe, expect, it } from 'vitest';
import type { ThreadState } from '@langchain/langgraph-sdk';
import { buildBranchTree } from './branch-tree';

function state(
  checkpointId: string,
  parentCheckpointId: string | null = null,
): ThreadState<{ messages: string[] }> {
  return {
    values: { messages: [checkpointId] },
    next: [],
    checkpoint: {
      thread_id: 'thread-1',
      checkpoint_ns: '',
      checkpoint_id: checkpointId,
      checkpoint_map: null,
    },
    metadata: null,
    created_at: `2026-05-02T00:00:00.000Z`,
    parent_checkpoint: parentCheckpointId
      ? {
          thread_id: 'thread-1',
          checkpoint_ns: '',
          checkpoint_id: parentCheckpointId,
          checkpoint_map: null,
        }
      : null,
    tasks: [],
  };
}

describe('buildBranchTree', () => {
  it('returns a linear sequence when history does not branch', () => {
    const root = state('root');
    const child = state('child', 'root');

    expect(buildBranchTree([root, child])).toEqual({
      type: 'sequence',
      items: [
        { type: 'node', value: root, path: [] },
        { type: 'node', value: child, path: [] },
      ],
    });
  });

  it('creates fork sequences with branch paths for sibling checkpoints', () => {
    const root = state('root');
    const left = state('left', 'root');
    const right = state('right', 'root');
    const leftChild = state('left-child', 'left');

    const tree = buildBranchTree([root, left, right, leftChild]);
    const fork = tree.items[1];

    expect(tree.items[0]).toEqual({ type: 'node', value: root, path: [] });
    expect(fork?.type).toBe('fork');
    if (fork?.type !== 'fork') throw new Error('Expected fork node');

    const branchHeads = fork.items.map(sequence => sequence.items[0]);
    expect(branchHeads).toEqual(
      expect.arrayContaining([
        { type: 'node', value: left, path: ['left'] },
        { type: 'node', value: right, path: ['right'] },
      ]),
    );

    const leftSequence = fork.items.find(sequence =>
      sequence.items.some(item => item.type === 'node' && item.value === left),
    );
    expect(leftSequence?.items).toContainEqual({
      type: 'node',
      value: leftChild,
      path: ['left'],
    });
  });

  it('builds from an orphaned parent when history is partial', () => {
    const child = state('child', 'missing-parent');
    const grandchild = state('grandchild', 'child');

    expect(buildBranchTree([child, grandchild])).toEqual({
      type: 'sequence',
      items: [
        { type: 'node', value: child, path: [] },
        { type: 'node', value: grandchild, path: [] },
      ],
    });
  });
});
