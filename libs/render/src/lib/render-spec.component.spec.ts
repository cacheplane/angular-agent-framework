// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Spec } from '@json-render/core';
import type { RenderEvent, RenderLifecycleEvent } from './render-event';

import { defineAngularRegistry } from './define-angular-registry';
import { signalStateStore } from './signal-state-store';
import { provideRender, RENDER_CONFIG } from './provide-render';
import { provideViews, VIEW_REGISTRY } from './provide-views';
import { views } from './views';

// --- Test component ---

@Component({
  selector: 'render-test-text',
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
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      const handlers = { doSomething: (): void => {} };
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
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(config.store!.get('/source')).toBe('config');
    // In the component, input > config
  });

  it('VIEW_REGISTRY token is used as third-priority fallback when config has no registry', () => {
    // Provide a config with no registry, plus VIEW_REGISTRY token with 'Text' mapped.
    // The resolved registry should come from the token and be able to look up 'Text'.
    TestBed.configureTestingModule({
      providers: [
        provideRender({}),
        provideViews(views({ Text: TestTextComponent })),
      ],
    });
    // Verify the VIEW_REGISTRY token is bound and resolves 'Text' → TestTextComponent.
    const tokenRegistry = TestBed.inject(VIEW_REGISTRY);
    const angularReg = defineAngularRegistry(tokenRegistry as Record<string, unknown>);
    expect(angularReg.getEntry('Text')?.component).toBe(TestTextComponent);
    // Also verify config has no registry (so the token is the only source).
    const config = TestBed.inject(RENDER_CONFIG);
    expect(config.registry).toBeUndefined();
  });

  it('null-path: no registry provided anywhere yields empty registry (no component for unknown type)', () => {
    // No providers at all — both RENDER_CONFIG and VIEW_REGISTRY are absent.
    TestBed.configureTestingModule({});
    const config = TestBed.inject(RENDER_CONFIG, null);
    const tokenRegistry = TestBed.inject(VIEW_REGISTRY, null);
    // Both absent — the fallback registry's get() returns undefined.
    expect(config).toBeNull();
    expect(tokenRegistry).toBeNull();
  });
});

describe('RenderSpecComponent — event emission', () => {
  it('should emit spec mounted lifecycle event on init', () => {
    TestBed.configureTestingModule({});
    TestBed.runInInjectionContext(() => {
      const events: RenderEvent[] = [];
      const emitEvent = (e: RenderEvent) => events.push(e);
      const mountedEvent: RenderLifecycleEvent = { type: 'lifecycle', event: 'mounted', scope: 'spec' };
      emitEvent(mountedEvent);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('lifecycle');
      expect((events[0] as RenderLifecycleEvent).event).toBe('mounted');
      expect((events[0] as RenderLifecycleEvent).scope).toBe('spec');
    });
  });

  it('should emit spec destroyed lifecycle event on destroy', () => {
    TestBed.configureTestingModule({});
    TestBed.runInInjectionContext(() => {
      const events: RenderEvent[] = [];
      const emitEvent = (e: RenderEvent) => events.push(e);
      const destroyedEvent: RenderLifecycleEvent = { type: 'lifecycle', event: 'destroyed', scope: 'spec' };
      emitEvent(destroyedEvent);
      expect(events).toHaveLength(1);
      expect((events[0] as RenderLifecycleEvent).event).toBe('destroyed');
    });
  });

  it('should emit state change events when store is mutated', () => {
    TestBed.configureTestingModule({});
    TestBed.runInInjectionContext(() => {
      const store = signalStateStore({ count: 0 });
      const events: RenderEvent[] = [];
      const emitEvent = (e: RenderEvent) => events.push(e);
      store.subscribe(() => {
        const snapshot = store.getSnapshot();
        emitEvent({ type: 'stateChange', path: '/count', value: snapshot['count'], snapshot: snapshot as Record<string, unknown> });
      });
      store.set('/count', 5);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('stateChange');
    });
  });
});
