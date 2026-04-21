// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { ChatCustomEvent } from './chat-custom-event';

describe('ChatCustomEvent', () => {
  it('accepts a minimal { type } event', () => {
    const event: ChatCustomEvent = { type: 'state_update' };
    expect(event.type).toBe('state_update');
  });

  it('accepts arbitrary additional fields via index signature', () => {
    const event: ChatCustomEvent = {
      type: 'a2ui.surface',
      surfaceId: 'main',
      payload: { foo: 'bar' },
      timestamp: 1234567890,
    };
    expect(event['surfaceId']).toBe('main');
    expect(event['payload']).toEqual({ foo: 'bar' });
  });

  it('allows AG-UI-shaped events to pass through without remapping', () => {
    const agUiEvent: ChatCustomEvent = {
      type: 'TEXT_MESSAGE_START',
      messageId: 'msg-1',
      role: 'assistant',
    };
    expect(agUiEvent.type).toBe('TEXT_MESSAGE_START');
    expect(agUiEvent['messageId']).toBe('msg-1');
  });
});
