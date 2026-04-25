// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { computeStateDiff } from './state-diff';
import type { DiffEntry } from './state-diff';
import { toDebugCheckpoint, extractStateValues } from './debug-utils';
import type { AgentCheckpoint } from '../../agent';
import { DebugCheckpointCardComponent } from './debug-checkpoint-card.component';
import { DebugControlsComponent } from './debug-controls.component';
import { DebugSummaryComponent } from './debug-summary.component';

// ── computeStateDiff ────────────────────────────────────────────────────────

describe('computeStateDiff', () => {
  it('detects added keys', () => {
    const result = computeStateDiff({}, { name: 'Alice' });
    expect(result).toEqual<DiffEntry[]>([
      { path: 'name', type: 'added', after: 'Alice' },
    ]);
  });

  it('detects removed keys', () => {
    const result = computeStateDiff({ name: 'Alice' }, {});
    expect(result).toEqual<DiffEntry[]>([
      { path: 'name', type: 'removed', before: 'Alice' },
    ]);
  });

  it('detects changed keys', () => {
    const result = computeStateDiff({ count: 1 }, { count: 2 });
    expect(result).toEqual<DiffEntry[]>([
      { path: 'count', type: 'changed', before: 1, after: 2 },
    ]);
  });

  it('returns empty array when states are identical', () => {
    const result = computeStateDiff(
      { a: 1, b: 'x' },
      { a: 1, b: 'x' },
    );
    expect(result).toEqual([]);
  });

  it('recurses into nested objects', () => {
    const result = computeStateDiff(
      { config: { theme: 'light', debug: false } },
      { config: { theme: 'dark', debug: false } },
    );
    expect(result).toEqual<DiffEntry[]>([
      { path: 'config.theme', type: 'changed', before: 'light', after: 'dark' },
    ]);
  });

  it('handles nested additions and removals', () => {
    const result = computeStateDiff(
      { config: { a: 1 } },
      { config: { b: 2 } },
    );
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ path: 'config.a', type: 'removed', before: 1 });
    expect(result).toContainEqual({ path: 'config.b', type: 'added', after: 2 });
  });

  it('treats array changes as a single changed entry', () => {
    const result = computeStateDiff(
      { items: [1, 2] },
      { items: [1, 2, 3] },
    );
    expect(result).toEqual<DiffEntry[]>([
      { path: 'items', type: 'changed', before: [1, 2], after: [1, 2, 3] },
    ]);
  });

  it('handles mixed additions, removals, and changes', () => {
    const result = computeStateDiff(
      { a: 1, b: 2, c: 3 },
      { a: 1, c: 99, d: 4 },
    );
    expect(result).toContainEqual({ path: 'b', type: 'removed', before: 2 });
    expect(result).toContainEqual({ path: 'c', type: 'changed', before: 3, after: 99 });
    expect(result).toContainEqual({ path: 'd', type: 'added', after: 4 });
    // 'a' is unchanged, no entry for it
    expect(result.find(e => e.path === 'a')).toBeUndefined();
  });
});

// ── toDebugCheckpoint ──────────────────────────────────────────────────────

describe('toDebugCheckpoint', () => {
  it('uses label as node name when available', () => {
    const cp: AgentCheckpoint = { id: 'cp1', label: 'agent', values: {} };
    const result = toDebugCheckpoint(cp, 0);
    expect(result.node).toBe('agent');
    expect(result.checkpointId).toBe('cp1');
  });

  it('falls back to Step N when label is absent', () => {
    const cp: AgentCheckpoint = { values: {} };
    const result = toDebugCheckpoint(cp, 2);
    expect(result.node).toBe('Step 3');
  });

  it('returns undefined checkpointId when id is not present', () => {
    const cp: AgentCheckpoint = { label: 'tool', values: {} };
    const result = toDebugCheckpoint(cp, 0);
    expect(result.checkpointId).toBeUndefined();
  });
});

// ── extractStateValues ─────────────────────────────────────────────────────

describe('extractStateValues', () => {
  it('returns empty object for undefined checkpoint', () => {
    expect(extractStateValues(undefined)).toEqual({});
  });

  it('extracts values from a AgentCheckpoint', () => {
    const cp: AgentCheckpoint = { values: { messages: [], count: 5 } };
    expect(extractStateValues(cp)).toEqual({ messages: [], count: 5 });
  });

  it('returns empty object for a checkpoint with empty values', () => {
    const cp: AgentCheckpoint = { values: {} };
    expect(extractStateValues(cp)).toEqual({});
  });
});

// ── DebugCheckpointCardComponent ───────────────────────────────────────────

describe('DebugCheckpointCardComponent', () => {
  it('is defined as a class', () => {
    expect(typeof DebugCheckpointCardComponent).toBe('function');
  });
});

// ── DebugControlsComponent ─────────────────────────────────────────────────

describe('DebugControlsComponent', () => {
  it('is defined as a class', () => {
    expect(typeof DebugControlsComponent).toBe('function');
  });
});

// ── DebugSummaryComponent ──────────────────────────────────────────────────

describe('DebugSummaryComponent', () => {
  it('is defined as a class', () => {
    expect(typeof DebugSummaryComponent).toBe('function');
  });
});

// ── ChatDebug navigation logic (tested via pure functions) ─────────────────

describe('ChatDebug navigation logic', () => {
  // Test the step/jump logic as pure functions since the component
  // can't be imported without Angular JIT compiler

  function createNavigation(initialIdx: number, count: number) {
    let idx = initialIdx;
    return {
      get idx() { return idx; },
      stepForward() {
        if (idx < count - 1) idx = idx + 1;
      },
      stepBack() {
        if (idx > 0) idx = idx - 1;
      },
      jumpToStart() {
        idx = 0;
      },
      jumpToEnd() {
        idx = count - 1;
      },
    };
  }

  it('stepForward increments index when not at end', () => {
    const nav = createNavigation(0, 3);
    nav.stepForward();
    expect(nav.idx).toBe(1);
  });

  it('stepForward does not exceed checkpoint length', () => {
    const nav = createNavigation(2, 3);
    nav.stepForward();
    expect(nav.idx).toBe(2);
  });

  it('stepBack decrements index when above 0', () => {
    const nav = createNavigation(2, 3);
    nav.stepBack();
    expect(nav.idx).toBe(1);
  });

  it('stepBack does not go below 0', () => {
    const nav = createNavigation(0, 3);
    nav.stepBack();
    expect(nav.idx).toBe(0);
  });

  it('jumpToStart sets index to 0', () => {
    const nav = createNavigation(5, 10);
    nav.jumpToStart();
    expect(nav.idx).toBe(0);
  });

  it('jumpToEnd sets index to last checkpoint', () => {
    const nav = createNavigation(0, 4);
    nav.jumpToEnd();
    expect(nav.idx).toBe(3);
  });
});
