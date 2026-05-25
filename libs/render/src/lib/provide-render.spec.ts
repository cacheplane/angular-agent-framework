// SPDX-License-Identifier: MIT
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideRender, RENDER_CONFIG } from './provide-render';
import { defineAngularRegistry } from './define-angular-registry';
import type { RenderConfig } from './render.types';

@Component({ selector: 'render-test-card', standalone: true, template: '<div>card</div>' })
class TestCardComponent {}

describe('provideRender', () => {
  beforeEach(() => {
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

  it('does not perform license checks because @threadplane/render is MIT-licensed', async () => {
    const legacyLicenseConfig = {
      license: 'invalid-token',
      __licenseEnvHint: { isNoncommercial: false },
    } as unknown as RenderConfig;

    TestBed.configureTestingModule({
      providers: [provideRender(legacyLicenseConfig)],
    });
    TestBed.inject(RENDER_CONFIG);
    await new Promise((r) => setTimeout(r, 0));
    const warn = globalThis.console.warn as ReturnType<typeof vi.fn>;
    expect(warn).not.toHaveBeenCalled();
  });
});
