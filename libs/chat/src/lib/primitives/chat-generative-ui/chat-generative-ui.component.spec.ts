// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { signal, computed } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { Spec, StateStore } from '@json-render/core';
import { signalStateStore, toRenderRegistry } from '@threadplane/render';
import { a2uiBasicCatalog } from '../../a2ui/catalog/index';
import { ChatGenerativeUiComponent } from './chat-generative-ui.component';
import { normalizeJsonRenderSpec } from './normalize-json-render-spec';

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

// ─────────────────────────────────────────────────────────────────────────────
// F4: json-render specs use the schema-documented `{ statePath: "/x" }` shape
// for state-bound props (the prompt in the example backends says:
//   props: { value: { statePath: "/name" } }
// and `state` carries the initial values). @json-render/core only resolves
// `$state`/`$bindState` expressions, so the raw object fell through to the
// view component and interpolated as the literal string "[object Object]".
// ─────────────────────────────────────────────────────────────────────────────

/** Spec fixture derived from the documented schema shapes (json_render.py):
 * a Text KPI bound via statePath + a Slider whose value/label bind via
 * statePath, with `state` carrying the initial value model. */
const statePathSpec = {
  root: 'col',
  elements: {
    col: { type: 'Column', props: { gap: 'medium' }, children: ['kpi', 'min'] },
    kpi: { type: 'Text', props: { text: { statePath: '/totalRevenue' }, usageHint: 'h3' } },
    min: {
      type: 'Slider',
      props: {
        label: 'Min revenue (USD)',
        value: { statePath: '/minRevenue' },
        minValue: 0,
        maxValue: 100000,
      },
    },
  },
  state: { totalRevenue: '$1.2M', minRevenue: 25000 },
} as unknown as Spec;

describe('ChatGenerativeUiComponent — statePath resolution (F4)', () => {
  let fixture: ComponentFixture<ChatGenerativeUiComponent>;
  let store: StateStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ChatGenerativeUiComponent] });
    fixture = TestBed.createComponent(ChatGenerativeUiComponent);
    // The chat composition passes its own (initially EMPTY) shared store —
    // replicate that so spec.state seeding is exercised, not render-spec's
    // internal store creation.
    store = signalStateStore({});
    fixture.componentRef.setInput('registry', toRenderRegistry(a2uiBasicCatalog()));
    fixture.componentRef.setInput('store', store);
    fixture.componentRef.setInput('spec', statePathSpec);
  });

  function render(): string {
    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('never renders "[object Object]" for statePath-bound props', () => {
    const text = render();
    expect(text).not.toContain('[object Object]');
  });

  it('resolves Text.text bound via statePath against spec.state', () => {
    const text = render();
    expect(text).toContain('$1.2M');
  });

  it('resolves Slider value bound via statePath (label shows the number)', () => {
    const text = render();
    expect(text).toContain('Min revenue (USD): 25000');
  });

  it('seeds spec.state into the provided store', () => {
    render();
    expect(store.get('/totalRevenue')).toBe('$1.2M');
    expect(store.get('/minRevenue')).toBe(25000);
  });

  it('writes slider input back to the bound state path', () => {
    render();
    const slider = (fixture.nativeElement as HTMLElement).querySelector(
      'input[type="range"]',
    ) as HTMLInputElement;
    expect(slider).toBeTruthy();
    slider.value = '30000';
    slider.dispatchEvent(new Event('input'));
    expect(store.get('/minRevenue')).toBe(30000);
  });

  it('does not clobber user-modified state when the spec re-emits', () => {
    render();
    store.set('/minRevenue', 42000);
    // Re-emit the same spec object graph (streaming re-materializes specs).
    fixture.componentRef.setInput('spec', { ...statePathSpec } as Spec);
    render();
    expect(store.get('/minRevenue')).toBe(42000);
  });
});

describe('normalizeJsonRenderSpec', () => {
  it('rewrites { statePath } props to $bindState + _bindings', () => {
    const out = normalizeJsonRenderSpec(statePathSpec);
    const kpi = out.elements['kpi'] as { props: Record<string, unknown> };
    expect(kpi.props['text']).toEqual({ $bindState: '/totalRevenue' });
    const min = out.elements['min'] as { props: Record<string, unknown> };
    expect(min.props['value']).toEqual({ $bindState: '/minRevenue' });
    expect(min.props['_bindings']).toEqual({ value: '/minRevenue' });
  });

  it('leaves scalar props untouched', () => {
    const out = normalizeJsonRenderSpec(statePathSpec);
    const min = out.elements['min'] as { props: Record<string, unknown> };
    expect(min.props['label']).toBe('Min revenue (USD)');
    expect(min.props['minValue']).toBe(0);
  });

  it('returns the same reference when no statePath props exist', () => {
    const plain = {
      root: 'a',
      elements: { a: { type: 'Text', props: { text: 'hello' } } },
      state: {},
    } as unknown as Spec;
    expect(normalizeJsonRenderSpec(plain)).toBe(plain);
  });

  it('ignores objects that merely contain a statePath key among others', () => {
    const spec = {
      root: 'a',
      elements: {
        a: { type: 'Text', props: { text: { statePath: '/x', other: 1 } } },
      },
      state: {},
    } as unknown as Spec;
    const out = normalizeJsonRenderSpec(spec);
    const a = out.elements['a'] as { props: Record<string, unknown> };
    expect(a.props['text']).toEqual({ statePath: '/x', other: 1 });
  });
});
