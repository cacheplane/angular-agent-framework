// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { A2uiTextComponent } from './text.component';

describe('A2uiTextComponent', () => {
  // Display-only component: renders text() input as a <span>.
  // No methods, events, or bindings — purely declarative.
  // Signal-based inputs require the angular() vite plugin for TestBed tests.

  it('exports the component class', () => {
    expect(A2uiTextComponent).toBeDefined();
  });
});
