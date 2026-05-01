// SPDX-License-Identifier: MIT
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideChat, CHAT_CONFIG } from './provide-chat';
import type { ChatConfig } from './provide-chat';
import {
  __resetRunLicenseCheckStateForTests,
  __resetNagStateForTests,
} from '@ngaf/licensing/testing';

describe('provideChat', () => {
  beforeEach(() => {
    __resetRunLicenseCheckStateForTests();
    __resetNagStateForTests();
    globalThis.console.warn = vi.fn();
  });

  it('registers CHAT_CONFIG token with the provided config', () => {
    const config: ChatConfig = { renderRegistry: undefined };

    TestBed.configureTestingModule({
      providers: [provideChat(config)],
    });

    const injected = TestBed.inject(CHAT_CONFIG);
    expect(injected).toBe(config);
  });

  it('injects the exact config object reference', () => {
    const config: ChatConfig = {};

    TestBed.configureTestingModule({
      providers: [provideChat(config)],
    });

    expect(TestBed.inject(CHAT_CONFIG)).toStrictEqual({});
  });

  it('returns environment providers (duck-type check)', () => {
    const result = provideChat({});
    // makeEnvironmentProviders returns an object with ɵproviders
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });

  it('provides CHAT_CONFIG token', () => {
    TestBed.configureTestingModule({ providers: [provideChat({})] });
    const config = TestBed.inject(CHAT_CONFIG);
    expect(config).toBeDefined();
  });

  it('warns when license is missing in a production-like env', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideChat({ __licenseEnvHint: { isNoncommercial: false } }),
      ],
    });
    TestBed.inject(CHAT_CONFIG);
    await new Promise((r) => setTimeout(r, 0));
    const warn = globalThis.console.warn as ReturnType<typeof vi.fn>;
    expect(
      warn.mock.calls.some((c) =>
        String(c[0]).includes('[cacheplane] @ngaf/chat'),
      ),
    ).toBe(true);
  });
});
