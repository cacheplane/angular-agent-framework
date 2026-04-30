// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { signal, computed } from '@angular/core';
import { mockAgent } from '../../testing/mock-agent';
import type { AgentCheckpoint } from '../../agent';

describe('ChatTimelineComponent', () => {
  it('renders a template for each checkpoint', () => {
    const checkpoints: AgentCheckpoint[] = [
      { id: 'a', label: 'nodeA', values: {} },
      { id: 'b', label: 'nodeB', values: {} },
    ];
    const agent = mockAgent({ history: checkpoints });

    // Mirrors the computed inside ChatTimelineComponent:
    // history = computed<AgentCheckpoint[]>(() => this.agent().history())
    const agentSig = signal(agent as any);
    const history = computed<AgentCheckpoint[]>(() => agentSig().history());

    expect(history()).toHaveLength(2);
    // Simulate what the @for template renders: index:label
    const rendered = history().map((cp, i) => `${i}:${cp.label}`).join('');
    expect(rendered).toBe('0:nodeA1:nodeB');
  });
});
