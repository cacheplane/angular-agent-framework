// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { Component } from '@angular/core';
import { defineAngularRegistry } from './define-angular-registry';

@Component({ selector: 'test-card', standalone: true, template: '<div>card</div>' })
class TestCardComponent {}

@Component({ selector: 'test-button', standalone: true, template: '<button>btn</button>' })
class TestButtonComponent {}

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
