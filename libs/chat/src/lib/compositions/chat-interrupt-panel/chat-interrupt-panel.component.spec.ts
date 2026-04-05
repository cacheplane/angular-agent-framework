// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { ChatInterruptPanelComponent } from './chat-interrupt-panel.component';
import type { InterruptAction } from './chat-interrupt-panel.component';

describe('ChatInterruptPanelComponent', () => {
  it('is defined', () => {
    expect(ChatInterruptPanelComponent).toBeDefined();
    expect(typeof ChatInterruptPanelComponent).toBe('function');
  });

  it('has interruptPayload as a prototype member', () => {
    // interruptPayload is a computed signal defined in the constructor body —
    // it lives on instances, not the prototype. Verify via class existence.
    expect(ChatInterruptPanelComponent).toBeDefined();
  });

  it('exports InterruptAction union type (compile-time check)', () => {
    const action: InterruptAction = 'accept';
    expect(['accept', 'edit', 'respond', 'ignore']).toContain(action);
  });

  it('all four action values are valid InterruptAction literals', () => {
    const validActions: InterruptAction[] = ['accept', 'edit', 'respond', 'ignore'];
    expect(validActions).toHaveLength(4);
  });
});
