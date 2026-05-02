// SPDX-License-Identifier: MIT
import type { ThreadState } from '@langchain/langgraph-sdk';
import type { AgentBranchTree, AgentBranchTreeFork } from '../agent.types';

const ROOT_ID = '$';

/**
 * Builds a branch-aware checkpoint tree from LangGraph thread history.
 *
 * This mirrors the small SDK UI branching data shape without importing the
 * SDK UI runtime helper, keeping Angular bundles independent of React UI code.
 */
export function buildBranchTree<T>(history: ThreadState<T>[] = []): AgentBranchTree<T> {
  if (history.length <= 1) {
    return {
      type: 'sequence',
      items: history.map(value => ({ type: 'node', value, path: [] })),
    };
  }

  const nodeIds = new Set<string>();
  const childrenMap: Record<string, ThreadState<T>[]> = {};

  for (const state of history) {
    const parentId = state.parent_checkpoint?.checkpoint_id ?? ROOT_ID;
    childrenMap[parentId] ??= [];
    childrenMap[parentId].push(state);

    const checkpointId = state.checkpoint?.checkpoint_id;
    if (checkpointId != null) {
      nodeIds.add(checkpointId);
    }
  }

  const orphanRoot = findLatestOrphanRoot(childrenMap, nodeIds);
  if (orphanRoot != null) {
    childrenMap[ROOT_ID] = childrenMap[orphanRoot];
  }

  const rootSequence: AgentBranchTree<T> = { type: 'sequence', items: [] };
  const queue: Array<{ id: string; sequence: AgentBranchTree<T>; path: string[] }> = [
    { id: ROOT_ID, sequence: rootSequence, path: [] },
  ];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const task = queue.shift();
    if (!task || visited.has(task.id)) continue;
    visited.add(task.id);

    const children = childrenMap[task.id];
    if (!children?.length) continue;

    let fork: AgentBranchTreeFork<T> | undefined;
    if (children.length > 1) {
      fork = { type: 'fork', items: [] };
      task.sequence.items.push(fork);
    }

    for (const value of children) {
      const id = value.checkpoint?.checkpoint_id;
      if (id == null) continue;

      let sequence = task.sequence;
      let path = task.path;
      if (fork != null) {
        sequence = { type: 'sequence', items: [] };
        fork.items.unshift(sequence);
        path = [...task.path, id];
      }

      sequence.items.push({ type: 'node', value, path });
      queue.push({ id, sequence, path });
    }
  }

  return rootSequence;
}

function findLatestOrphanRoot<T>(
  childrenMap: Record<string, ThreadState<T>[]>,
  nodeIds: Set<string>,
): string | undefined {
  if (childrenMap[ROOT_ID] != null) return undefined;

  return Object.keys(childrenMap)
    .filter(parentId => !nodeIds.has(parentId))
    .map(parentId => ({
      parentId,
      lastId: findLatestDescendantId(parentId, childrenMap),
    }))
    .sort((left, right) => left.lastId.localeCompare(right.lastId))
    .at(-1)?.parentId;
}

function findLatestDescendantId<T>(
  parentId: string,
  childrenMap: Record<string, ThreadState<T>[]>,
): string {
  const queue = [parentId];
  const seen = new Set<string>();
  let latestId = parentId;

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);

    for (const child of childrenMap[current] ?? []) {
      const childId = child.checkpoint?.checkpoint_id;
      if (childId == null) continue;
      if (childId.localeCompare(latestId) > 0) {
        latestId = childId;
      }
      queue.push(childId);
    }
  }

  return latestId;
}
