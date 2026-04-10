// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect, vi } from 'vitest';
import { emitBinding } from './emit-binding';

describe('A2uiTabsComponent — selectTab logic', () => {
  it('should emit binding event on tab selection', () => {
    const emit = vi.fn();
    const bindings = { selected: '/activeTab' };
    emitBinding(emit, bindings, 'selected', 2);
    expect(emit).toHaveBeenCalledWith('a2ui:datamodel:/activeTab:2');
  });

  it('should compute active child keys from tab index', () => {
    const tabs = [
      { label: 'Tab 1', childKeys: ['a', 'b'] },
      { label: 'Tab 2', childKeys: ['c'] },
    ];
    // Simulates activeChildKeys computed signal logic
    const getActiveChildKeys = (index: number) =>
      index >= 0 && index < tabs.length ? tabs[index].childKeys : [];

    expect(getActiveChildKeys(0)).toEqual(['a', 'b']);
    expect(getActiveChildKeys(1)).toEqual(['c']);
    expect(getActiveChildKeys(5)).toEqual([]);
  });
});
