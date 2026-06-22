// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { A2uiIconComponent, toMaterialSymbolName } from './icon.component';

describe('A2uiIconComponent', () => {
  // Display-only component: renders name() input as a <span>.
  // No methods, events, or bindings — purely declarative.
  // Signal-based inputs require the angular() vite plugin for TestBed tests.

  it('exports the component class', () => {
    expect(A2uiIconComponent).toBeDefined();
  });
});

describe('toMaterialSymbolName', () => {
  it('converts camelCase identifiers to snake_case ligatures', () => {
    expect(toMaterialSymbolName('accountCircle')).toBe('account_circle');
    expect(toMaterialSymbolName('shoppingCart')).toBe('shopping_cart');
    expect(toMaterialSymbolName('moreVert')).toBe('more_vert');
    expect(toMaterialSymbolName('visibilityOff')).toBe('visibility_off');
    expect(toMaterialSymbolName('arrowForward')).toBe('arrow_forward');
  });

  it('passes single-word and already-snake_case names through unchanged', () => {
    expect(toMaterialSymbolName('check')).toBe('check');
    expect(toMaterialSymbolName('star')).toBe('star');
    expect(toMaterialSymbolName('trending_up')).toBe('trending_up');
  });

  it('leaves non-identifier glyphs (emoji) untouched', () => {
    expect(toMaterialSymbolName('✓')).toBe('✓');
    expect(toMaterialSymbolName('⚠️')).toBe('⚠️');
  });
});
