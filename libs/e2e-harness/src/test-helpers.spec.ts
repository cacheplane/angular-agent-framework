// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import type { SendPromptAndWaitOptions } from './test-helpers';

// The helper itself is integration-level (drives a real Playwright page);
// per-example specs exercise it. This file just locks in the type contract.

describe('SendPromptAndWaitOptions', () => {
  it('accepts an empty options object', () => {
    const opts: SendPromptAndWaitOptions = {};
    expect(opts.path).toBeUndefined();
  });

  it('accepts a path override', () => {
    const opts: SendPromptAndWaitOptions = { path: '/embed' };
    expect(opts.path).toBe('/embed');
  });
});
