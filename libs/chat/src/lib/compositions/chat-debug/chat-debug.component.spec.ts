// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { computeStateDiff } from './state-diff';
import type { DiffEntry } from './state-diff';
import { toDebugCheckpoint, extractStateValues } from './debug-utils';
import type { AgentCheckpoint } from '../../agent';
import { DebugCheckpointCardComponent } from './debug-checkpoint-card.component';
import { ChatDebugComponent } from './chat-debug.component';

// ── computeStateDiff (unchanged from previous spec) ────────────────────────

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
    expect(computeStateDiff({ a: 1 }, { a: 1 })).toEqual([]);
  });
  it('recurses into nested objects', () => {
    const result = computeStateDiff(
      { config: { theme: 'light' } },
      { config: { theme: 'dark' } },
    );
    expect(result).toEqual<DiffEntry[]>([
      { path: 'config.theme', type: 'changed', before: 'light', after: 'dark' },
    ]);
  });
  it('treats array changes as a single changed entry', () => {
    const result = computeStateDiff({ items: [1] }, { items: [1, 2] });
    expect(result).toEqual<DiffEntry[]>([
      { path: 'items', type: 'changed', before: [1], after: [1, 2] },
    ]);
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
    expect(toDebugCheckpoint(cp, 2).node).toBe('Step 3');
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
});

// ── Defined-as-class smoke tests ──────────────────────────────────────────

describe('ChatDebugComponent', () => {
  it('is defined as a class', () => {
    expect(typeof ChatDebugComponent).toBe('function');
  });
});

describe('DebugCheckpointCardComponent', () => {
  it('is defined as a class', () => {
    expect(typeof DebugCheckpointCardComponent).toBe('function');
  });
});
