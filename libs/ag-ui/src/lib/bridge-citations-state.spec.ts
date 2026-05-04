// libs/ag-ui/src/lib/bridge-citations-state.spec.ts
// SPDX-License-Identifier: MIT
import { bridgeCitationsState } from './bridge-citations-state';
import type { Message } from '@ngaf/chat';

describe('bridgeCitationsState', () => {
  const baseMsg = (id: string): Message => ({ id, role: 'assistant', content: 'x' });

  it('returns messages unchanged when state has no citations', () => {
    const msgs = [baseMsg('m1'), baseMsg('m2')];
    const result = bridgeCitationsState({ state: {} }, msgs);
    expect(result).toEqual(msgs);
  });

  it('merges citations into matching messages by id', () => {
    const result = bridgeCitationsState(
      { state: { citations: { m1: [{ id: 'a', title: 'A', url: 'https://a' }] } } },
      [baseMsg('m1'), baseMsg('m2')],
    );
    expect(result[0].citations).toEqual([{ id: 'a', index: 1, title: 'A', url: 'https://a' }]);
    expect(result[1].citations).toBeUndefined();
  });

  it('idempotent — same input produces same output', () => {
    const state = { state: { citations: { m1: [{ id: 'a', title: 'A' }] } } };
    const msgs = [baseMsg('m1')];
    const a = bridgeCitationsState(state, msgs);
    const b = bridgeCitationsState(state, a);
    expect(b[0].citations).toEqual(a[0].citations);
  });

  it('coerces key spellings (href/source, name, excerpt)', () => {
    const result = bridgeCitationsState(
      { state: { citations: { m1: [{ name: 'N', href: 'https://h', excerpt: 'E' }] } } },
      [baseMsg('m1')],
    );
    expect(result[0].citations).toEqual([
      { id: 'c1', index: 1, title: 'N', url: 'https://h', snippet: 'E' },
    ]);
  });

  it('handles string entries', () => {
    const result = bridgeCitationsState(
      { state: { citations: { m1: ['https://x'] } } },
      [baseMsg('m1')],
    );
    expect(result[0].citations).toEqual([{ id: 'c1', index: 1, url: 'https://x' }]);
  });
});
