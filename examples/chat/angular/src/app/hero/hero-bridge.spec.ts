// SPDX-License-Identifier: MIT
import { describe, expect, it, vi } from 'vitest';
import { HERO_PARENT_ORIGINS, createHeroBridge } from './hero-bridge';

describe('createHeroBridge', () => {
  it('posts state to the parent when the referrer origin is allowlisted', () => {
    const post = vi.fn();
    const b = createHeroBridge({
      referrer: 'https://threadplane.ai/',
      parent: { postMessage: post } as unknown as Window,
      self: {} as Window,
    });
    b.postState('ready');
    expect(post).toHaveBeenCalledWith({ type: 'tplane-hero', state: 'ready' }, 'https://threadplane.ai');
  });
  it('does not post when the referrer is not allowlisted', () => {
    const post = vi.fn();
    const b = createHeroBridge({
      referrer: 'https://evil.example/',
      parent: { postMessage: post } as unknown as Window,
      self: {} as Window,
    });
    b.postState('ready');
    expect(post).not.toHaveBeenCalled();
  });
  it('delivers visibility only from an allowlisted origin', () => {
    const listeners: ((e: MessageEvent) => void)[] = [];
    const self = {
      addEventListener: (_: string, l: (e: MessageEvent) => void) => listeners.push(l),
      removeEventListener: vi.fn(),
    } as unknown as Window;
    const b = createHeroBridge({ referrer: '', parent: { postMessage: vi.fn() } as unknown as Window, self });
    const seen: boolean[] = [];
    b.onVisibility((v) => seen.push(v));
    listeners[0]({ origin: 'https://threadplane.ai', data: { type: 'tplane-hero', visible: true } } as MessageEvent);
    listeners[0]({ origin: 'https://evil.example', data: { type: 'tplane-hero', visible: false } } as MessageEvent);
    listeners[0]({ origin: 'http://localhost:3000', data: { type: 'other' } } as MessageEvent);
    expect(seen).toEqual([true]);
  });
  it('allowlist contains the production and local website origins', () => {
    expect(HERO_PARENT_ORIGINS).toEqual([
      'https://threadplane.ai',
      'https://www.threadplane.ai',
      'http://localhost:3000',
      'http://127.0.0.1:4308',
    ]);
  });
});
