// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import type {
  AgentEvent,
  AgentStateUpdateEvent,
  AgentCustomEvent,
} from './agent-event';

describe('AgentEvent', () => {
  it('narrows AgentStateUpdateEvent by type discriminator', () => {
    const e: AgentEvent = { type: 'state_update', data: { foo: 1 } };
    if (e.type === 'state_update') {
      expect(e.data.foo).toBe(1);
    }
  });

  it('narrows AgentCustomEvent by type discriminator', () => {
    const e: AgentEvent = { type: 'custom', name: 'tick', data: 42 };
    if (e.type === 'custom') {
      expect(e.name).toBe('tick');
      expect(e.data).toBe(42);
    }
  });

  it('AgentStateUpdateEvent.data is Record-shaped', () => {
    const e: AgentStateUpdateEvent = { type: 'state_update', data: {} };
    expect(typeof e.data).toBe('object');
  });

  it('AgentCustomEvent.data is unknown', () => {
    const e: AgentCustomEvent = { type: 'custom', name: 'x', data: null };
    expect(e.data).toBeNull();
  });
});
