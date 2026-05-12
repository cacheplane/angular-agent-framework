// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { Component } from '@angular/core';
import { defineAngularRegistry } from './define-angular-registry';
import { DefaultFallbackComponent } from './default-fallback.component';

@Component({ selector: 'render-test-card', standalone: true, template: '<div>card</div>' })
class TestCardComponent {}

@Component({ selector: 'render-test-button', standalone: true, template: '<button>btn</button>' })
class TestButtonComponent {}

@Component({ standalone: true, template: '<span>real</span>' })
class FakeRealComponent {}

@Component({ standalone: true, template: '<span>fallback</span>' })
class FakeFallbackComponent {}

describe('defineAngularRegistry', () => {
  it('should create a registry mapping component names to Angular components', () => {
    const registry = defineAngularRegistry({
      Card: TestCardComponent,
      Button: TestButtonComponent,
    });
    expect(registry.get('Card')).toBe(TestCardComponent);
    expect(registry.get('Button')).toBe(TestButtonComponent);
  });

  it('should return undefined for unregistered component names', () => {
    const registry = defineAngularRegistry({ Card: TestCardComponent });
    expect(registry.get('Unknown')).toBeUndefined();
  });

  it('should return all registered component names', () => {
    const registry = defineAngularRegistry({
      Card: TestCardComponent,
      Button: TestButtonComponent,
    });
    expect(registry.names()).toEqual(['Card', 'Button']);
  });
});

describe('defineAngularRegistry — fallback API', () => {
  it('bare type entry: get returns the type; getFallback returns the default', () => {
    const reg = defineAngularRegistry({ button: FakeRealComponent });
    expect(reg.get('button')).toBe(FakeRealComponent);
    expect(reg.getFallback('button')).toBe(DefaultFallbackComponent);
  });

  it('object entry with fallback: get returns component; getFallback returns the configured fallback', () => {
    const reg = defineAngularRegistry({
      button: { component: FakeRealComponent, fallback: FakeFallbackComponent },
    });
    expect(reg.get('button')).toBe(FakeRealComponent);
    expect(reg.getFallback('button')).toBe(FakeFallbackComponent);
  });

  it('object entry without fallback: getFallback returns the default', () => {
    const reg = defineAngularRegistry({ button: { component: FakeRealComponent } });
    expect(reg.get('button')).toBe(FakeRealComponent);
    expect(reg.getFallback('button')).toBe(DefaultFallbackComponent);
  });

  it('unknown name: get returns undefined; getFallback returns undefined', () => {
    const reg = defineAngularRegistry({ button: FakeRealComponent });
    expect(reg.get('unknown')).toBeUndefined();
    expect(reg.getFallback('unknown')).toBeUndefined();
  });

  it('names() returns all registered keys regardless of entry shape', () => {
    const reg = defineAngularRegistry({
      button: FakeRealComponent,
      card: { component: FakeRealComponent, fallback: FakeFallbackComponent },
    });
    expect(reg.names().sort()).toEqual(['button', 'card']);
  });
});
