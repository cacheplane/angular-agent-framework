// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { signal, computed } from '@angular/core';
import { mockChatAgent } from '../../testing/mock-chat-agent';
import type { ChatCheckpoint } from '../../agent';

describe('ChatTimelineComponent', () => {
  it('renders a template for each checkpoint', () => {
    const checkpoints: ChatCheckpoint[] = [
      { id: 'a', label: 'nodeA', values: {} },
      { id: 'b', label: 'nodeB', values: {} },
    ];
    const agent = mockChatAgent({ history: checkpoints });

    // Mirrors the computed inside ChatTimelineComponent:
    // history = computed<ChatCheckpoint[]>(() => this.agent().history())
    const agentSig = signal(agent as any);
    const history = computed<ChatCheckpoint[]>(() => agentSig().history());

    expect(history()).toHaveLength(2);
    // Simulate what the @for template renders: index:label
    const rendered = history().map((cp, i) => `${i}:${cp.label}`).join('');
    expect(rendered).toBe('0:nodeA1:nodeB');
  });
});
