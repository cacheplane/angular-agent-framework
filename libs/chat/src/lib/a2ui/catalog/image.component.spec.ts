// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { A2uiImageComponent } from './image.component';

describe('A2uiImageComponent', () => {
  // Display-only component: renders url() and alt() as an <img>.
  // No methods, events, or bindings — purely declarative.
  // Signal-based inputs require the angular() vite plugin for TestBed tests.

  it('exports the component class', () => {
    expect(A2uiImageComponent).toBeDefined();
  });
});
