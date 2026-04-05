// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { signal, computed } from '@angular/core';
import type { Spec } from '@json-render/core';

const makeSpec = (root = 'root'): Spec =>
  ({ root, elements: { root: { type: 'div', props: {} } } } as any);

describe('ChatGenerativeUiComponent — spec input', () => {
  it('spec input defaults to null', () => {
    const spec$ = signal<Spec | null>(null);
    expect(spec$()).toBeNull();
  });

  it('renders when spec is present', () => {
    const spec$ = signal<Spec | null>(makeSpec());
    const shouldRender = computed(() => spec$() !== null);

    expect(shouldRender()).toBe(true);
  });

  it('does not render when spec is null', () => {
    const spec$ = signal<Spec | null>(null);
    const shouldRender = computed(() => spec$() !== null);

    expect(shouldRender()).toBe(false);
  });

  it('spec updates reactively', () => {
    const spec$ = signal<Spec | null>(null);
    const shouldRender = computed(() => spec$() !== null);

    expect(shouldRender()).toBe(false);
    spec$.set(makeSpec());
    expect(shouldRender()).toBe(true);
  });

  it('loading input defaults to false', () => {
    const loading$ = signal<boolean>(false);
    expect(loading$()).toBe(false);
  });

  it('loading can be set to true', () => {
    const loading$ = signal<boolean>(true);
    expect(loading$()).toBe(true);
  });
});
