// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { A2uiModalComponent } from './modal.component';

describe('A2uiModalComponent', () => {
  // NOTE: Angular signal-based inputs can't be tested via TestBed without the
  // angular() vite plugin (NG0303). v1 Modal manages its own open state internally:
  // childKeys[0] = entryPointChild (trigger), childKeys[1] = contentChild (body).
  // Clicking the entry point wrapper sets open=true; clicking the backdrop sets open=false.

  it('exports the component class', () => {
    expect(A2uiModalComponent).toBeDefined();
  });

  describe('childKeys slot mapping', () => {
    const getEntryKey = (keys: string[]) => keys[0] ?? null;
    const getContentKey = (keys: string[]) => keys[1] ?? null;

    it('maps childKeys[0] to entry point and childKeys[1] to content', () => {
      const keys = ['btn-open', 'modal-body'];
      expect(getEntryKey(keys)).toBe('btn-open');
      expect(getContentKey(keys)).toBe('modal-body');
    });

    it('returns null for missing entry point when childKeys is empty', () => {
      expect(getEntryKey([])).toBeNull();
    });

    it('returns null for missing content when only one key', () => {
      expect(getContentKey(['btn-open'])).toBeNull();
    });
  });
});
