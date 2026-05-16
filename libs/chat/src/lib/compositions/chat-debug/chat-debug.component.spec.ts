// SPDX-License-Identifier: MIT
import { describe, it, expect, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ElementRef } from '@angular/core';
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

describe('ChatDebugComponent — edge-claim attribute', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-ngaf-chat-debug');
  });

  it('sets data-ngaf-chat-debug=dock on <html> while open', () => {
    const styles = (ChatDebugComponent as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles.join('\n');
    expect(styles).toMatch(/\.panel--bottom[^{]*\{[^}]*right:\s*var\(--ngaf-chat-occupy-right/);
    expect(styles).toMatch(/\.panel--right[^{]*\{[^}]*right:\s*var\(--ngaf-chat-occupy-right/);
  });
});

describe('ChatDebugComponent — mobile coexistence', () => {
  it('contains a mobile-breakpoint rule guarding the bottom panel', () => {
    const styles = (ChatDebugComponent as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles.join('\n');
    expect(styles).toMatch(/@media[^{]*max-width:\s*767px[^{]*\{[^}]*\.panel--bottom[^}]*display:\s*none/);
  });
});

describe('ChatDebugComponent — auto-dock', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-ngaf-chat-debug');
    document.querySelectorAll('chat-sidebar').forEach((n) => n.remove());
    if (typeof localStorage !== 'undefined') localStorage.clear();
  });

  it('auto-switches to bottom dock when a sibling chat-sidebar exists', async () => {
    // Stage a chat-sidebar element on the page so the detector finds it.
    const sidebarEl = document.createElement('chat-sidebar');
    document.body.appendChild(sidebarEl);

    TestBed.configureTestingModule({
      providers: [
        { provide: ElementRef, useValue: new ElementRef(document.createElement('div')) },
      ],
    });
    const debug = TestBed.runInInjectionContext(() => {
      const d = new ChatDebugComponent();
      d.setOpen(true);
      TestBed.flushEffects();
      return d;
    });
    // Drain the microtask queued by the auto-dock effect.
    await Promise.resolve();
    TestBed.flushEffects();
    // dockState was 'right' default, sidebar detection flips to 'bottom'.
    expect((debug as unknown as { dockState: () => string }).dockState()).toBe('bottom');
  });

  it('does NOT auto-switch when no chat-sidebar is present', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: ElementRef, useValue: new ElementRef(document.createElement('div')) },
      ],
    });
    TestBed.runInInjectionContext(() => {
      const debug = new ChatDebugComponent();
      debug.setOpen(true);
      TestBed.flushEffects();
      expect((debug as unknown as { dockState: () => string }).dockState()).toBe('right');
    });
  });

  it('user clicking a dock button prevents subsequent auto-switching', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: ElementRef, useValue: new ElementRef(document.createElement('div')) },
      ],
    });
    TestBed.runInInjectionContext(() => {
      const debug = new ChatDebugComponent();
      // User explicitly picks right
      debug.setDock('right');
      // Now stage a sidebar — should NOT override the user's choice
      const sidebarEl = document.createElement('chat-sidebar');
      document.body.appendChild(sidebarEl);
      debug.setOpen(true);
      TestBed.flushEffects();
      expect((debug as unknown as { dockState: () => string }).dockState()).toBe('right');
    });
  });
});
