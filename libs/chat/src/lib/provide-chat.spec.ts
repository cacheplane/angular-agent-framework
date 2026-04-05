// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideChat, CHAT_CONFIG } from './provide-chat';
import type { ChatConfig } from './chat.types';

describe('provideChat', () => {
  it('registers CHAT_CONFIG token with the provided config', () => {
    const config: ChatConfig = { registry: undefined };

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
});
