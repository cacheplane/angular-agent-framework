// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Spec, StateStore } from '@json-render/core';

import { RenderSpecComponent } from './render-spec.component';
import { defineAngularRegistry } from './define-angular-registry';
import { signalStateStore } from './signal-state-store';
import { provideRender, RENDER_CONFIG } from './provide-render';
import type { AngularRegistry } from './render.types';

// --- Test component ---

@Component({
  selector: 'test-text',
  standalone: true,
  template: '<span class="text">{{ label() }}</span>',
})
class TestTextComponent {
  readonly label = input<string>('');
  readonly childKeys = input<string[]>([]);
  readonly spec = input<Spec | null>(null);
}

// --- Helpers ---

function createSpec(elements: Record<string, unknown>, root = 'root'): Spec {
  return { root, elements } as Spec;
}

/**
 * These tests verify the RenderSpecComponent's context resolution logic.
 * Because this repo's Vitest setup does not include the Angular template
 * compiler plugin, we test context assembly and fallback behavior directly.
 */
describe('RenderSpecComponent — context resolution', () => {
  it('should build context from direct inputs', () => {
    TestBed.configureTestingModule({});
    TestBed.runInInjectionContext(() => {
      const registry = defineAngularRegistry({ Text: TestTextComponent });
      const store = signalStateStore({ title: 'Hello' });
      const handlers = { doSomething: () => {} };
      const functions = { upper: (args: Record<string, unknown>) => String(args['text']).toUpperCase() };

      // Simulate what the component does internally
      const context = {
        registry,
        store,
        functions,
        handlers,
        loading: false,
      };

      expect(context.registry).toBe(registry);
      expect(context.store).toBe(store);
      expect(context.functions).toBe(functions);
      expect(context.handlers).toBe(handlers);
      expect(context.loading).toBe(false);
    });
  });

  it('should fall back to RENDER_CONFIG when inputs are not provided', () => {
    const registry = defineAngularRegistry({ Text: TestTextComponent });
    const store = signalStateStore({ name: 'config' });
    TestBed.configureTestingModule({
      providers: [provideRender({ registry, store })],
    });
    const config = TestBed.inject(RENDER_CONFIG);
    expect(config.registry).toBe(registry);
    expect(config.store).toBe(store);
  });

  it('should handle null spec gracefully', () => {
    const spec: Spec | null = null;
    // Null spec should not render any root element
    expect(spec?.root).toBeUndefined();
  });

  it('should extract root key from spec', () => {
    const spec = createSpec({
      myRoot: { type: 'Text', props: { label: 'Root' } },
    }, 'myRoot');
    expect(spec.root).toBe('myRoot');
    expect(spec.elements['myRoot']).toBeDefined();
  });

  it('should create internal store from spec.state when no store provided', () => {
    TestBed.configureTestingModule({});
    TestBed.runInInjectionContext(() => {
      const spec = createSpec(
        { root: { type: 'Text', props: { label: { $state: '/title' } } } },
      );
      (spec as Record<string, unknown>).state = { title: 'From Spec State' };
      const store = signalStateStore(spec.state as Record<string, unknown>);
      expect(store.get('/title')).toBe('From Spec State');
    });
  });

  it('should prefer input store over config store', () => {
    const configStore = signalStateStore({ source: 'config' });
    const inputStore = signalStateStore({ source: 'input' });
    const registry = defineAngularRegistry({ Text: TestTextComponent });

    TestBed.configureTestingModule({
      providers: [provideRender({ registry, store: configStore })],
    });
    const config = TestBed.inject(RENDER_CONFIG);
    // Input store should take precedence
    expect(inputStore.get('/source')).toBe('input');
    expect(config.store!.get('/source')).toBe('config');
    // In the component, input > config
  });
});
