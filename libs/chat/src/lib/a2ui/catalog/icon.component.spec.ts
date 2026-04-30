// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { A2uiIconComponent } from './icon.component';

describe('A2uiIconComponent', () => {
  // Display-only component: renders name() input as a <span>.
  // No methods, events, or bindings — purely declarative.
  // Signal-based inputs require the angular() vite plugin for TestBed tests.

  it('exports the component class', () => {
    expect(A2uiIconComponent).toBeDefined();
  });
});
