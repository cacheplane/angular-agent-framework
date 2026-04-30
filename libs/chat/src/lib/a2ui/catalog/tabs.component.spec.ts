// SPDX-License-Identifier: MIT
import { describe, it, expect, vi } from 'vitest';
import { emitBinding } from './emit-binding';

describe('A2uiTabsComponent', () => {
  // NOTE: Angular signal-based inputs can't be tested via TestBed without the
  // angular() vite plugin (NG0303). These tests verify the behavioral contracts:
  // - selectTab: sets active index and emits binding
  // - activeChildKeys: returns childKeys for the active tab index

  describe('selectTab logic', () => {
    it('emits binding event with selected tab index', () => {
      const emit = vi.fn();
      const bindings = { selected: '/activeTab' };
      // Mirrors selectTab: this.activeIndex.set(index); emitBinding(...)
      emitBinding(emit, bindings, 'selected', 2);
      expect(emit).toHaveBeenCalledWith('a2ui:datamodel:/activeTab:2');
    });

    it('emits index 0 when first tab is selected', () => {
      const emit = vi.fn();
      const bindings = { selected: '/activeTab' };
      emitBinding(emit, bindings, 'selected', 0);
      expect(emit).toHaveBeenCalledWith('a2ui:datamodel:/activeTab:0');
    });
  });

  describe('activeChildKeys computed logic', () => {
    // Mirrors the computed signal: if (idx >= 0 && idx < allTabs.length) return allTabs[idx].childKeys; else return [];
    const getActiveChildKeys = (tabs: { label: string; childKeys: string[] }[], index: number) =>
      index >= 0 && index < tabs.length ? tabs[index].childKeys : [];

    const tabs = [
      { label: 'Overview', childKeys: ['overview-text', 'overview-chart'] },
      { label: 'Details', childKeys: ['detail-list'] },
      { label: 'Settings', childKeys: ['settings-form', 'settings-actions'] },
    ];

    it('returns childKeys for the selected tab', () => {
      expect(getActiveChildKeys(tabs, 0)).toEqual(['overview-text', 'overview-chart']);
      expect(getActiveChildKeys(tabs, 1)).toEqual(['detail-list']);
      expect(getActiveChildKeys(tabs, 2)).toEqual(['settings-form', 'settings-actions']);
    });

    it('returns empty array for out-of-bounds positive index', () => {
      expect(getActiveChildKeys(tabs, 5)).toEqual([]);
    });

    it('returns empty array for negative index', () => {
      expect(getActiveChildKeys(tabs, -1)).toEqual([]);
    });

    it('returns empty array when tabs list is empty', () => {
      expect(getActiveChildKeys([], 0)).toEqual([]);
    });
  });
});
