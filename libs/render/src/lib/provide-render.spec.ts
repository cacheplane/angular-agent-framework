// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideRender, RENDER_CONFIG } from './provide-render';
import { defineAngularRegistry } from './define-angular-registry';
import type { RenderConfig } from './render.types';
import {
  __resetRunLicenseCheckStateForTests,
  __resetNagStateForTests,
} from '@cacheplane/licensing/testing';

@Component({ selector: 'render-test-card', standalone: true, template: '<div>card</div>' })
class TestCardComponent {}

describe('provideRender', () => {
  beforeEach(() => {
    __resetRunLicenseCheckStateForTests();
    __resetNagStateForTests();
    globalThis.console.warn = vi.fn();
  });

  it('should provide RenderConfig via injection token', () => {
    const registry = defineAngularRegistry({ Card: TestCardComponent });
    const config: RenderConfig = { registry };
    TestBed.configureTestingModule({ providers: [provideRender(config)] });
    const injectedConfig = TestBed.inject(RENDER_CONFIG);
    expect(injectedConfig.registry).toBe(registry);
  });

  it('should allow injection without provider (returns undefined)', () => {
    TestBed.configureTestingModule({});
    const injectedConfig = TestBed.inject(RENDER_CONFIG, null);
    expect(injectedConfig).toBeNull();
  });

  it('provides RENDER_CONFIG token', () => {
    TestBed.configureTestingModule({ providers: [provideRender({})] });
    const config = TestBed.inject(RENDER_CONFIG);
    expect(config).toBeDefined();
  });

  it('warns when license is missing in a production-like env', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRender({ __licenseEnvHint: { isNoncommercial: false } }),
      ],
    });
    TestBed.inject(RENDER_CONFIG);
    await new Promise((r) => setTimeout(r, 0));
    const warn = globalThis.console.warn as ReturnType<typeof vi.fn>;
    expect(
      warn.mock.calls.some((c) =>
        String(c[0]).includes('[cacheplane] @cacheplane/render'),
      ),
    ).toBe(true);
  });
});
