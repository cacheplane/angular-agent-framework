// SPDX-License-Identifier: MIT
import { beforeEach, describe, expect, it, vi } from 'vitest';

const clientConstructor = vi.hoisted(() =>
  vi.fn(function Client() {
    return Object.create(null);
  })
);

vi.mock('@langchain/langgraph-sdk', () => ({ Client: clientConstructor }));

import { createLangGraphClient } from './create-langgraph-client';

describe('createLangGraphClient', () => {
  beforeEach(() => clientConstructor.mockClear());

  it('passes apiUrl, an explicit apiKey, and callerOptions to the SDK Client', () => {
    createLangGraphClient('https://runtime.example/api', {
      apiKey: 'test-key-redact-me',
      maxRetries: 0,
    });

    expect(clientConstructor).toHaveBeenCalledWith({
      apiUrl: 'https://runtime.example/api',
      apiKey: 'test-key-redact-me',
      callerOptions: { maxRetries: 0 },
    });
  });

  it('passes null explicitly so the SDK does not fall back to environment keys', () => {
    createLangGraphClient('https://runtime.example/api', { apiKey: null });

    expect(clientConstructor).toHaveBeenCalledWith({
      apiUrl: 'https://runtime.example/api',
      apiKey: null,
    });
  });

  it('preserves SDK defaults when client options are absent', () => {
    createLangGraphClient('https://runtime.example/api');

    expect(clientConstructor).toHaveBeenCalledWith({
      apiUrl: 'https://runtime.example/api',
    });
  });
});
