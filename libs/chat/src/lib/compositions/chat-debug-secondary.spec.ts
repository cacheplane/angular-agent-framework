// SPDX-License-Identifier: MIT
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { mockAgent } from '../testing/mock-agent';
import { ChatDebugComponent } from '../../../debug/public-api';
import { StateInspectorComponent } from '../../../debug/src/lib/compositions/chat-debug/inspectors/state-inspector.component';

describe('chat debug secondary entrypoint', () => {
  it('exports ChatDebugComponent from @ngaf/chat/debug', () => {
    expect(typeof ChatDebugComponent).toBe('function');
  });

  it('accepts a base Agent without checkpoint history for state inspection', () => {
    const fixture = TestBed.createComponent(StateInspectorComponent);
    fixture.componentRef.setInput('agent', mockAgent({ state: { count: 2 } }));
    fixture.detectChanges();
    expect((fixture.componentInstance as unknown as { state: () => Record<string, unknown> }).state()).toEqual({ count: 2 });
  });

  it('renders through the secondary component with a base Agent', () => {
    @Component({
      standalone: true,
      imports: [ChatDebugComponent],
      template: `<chat-debug [agent]="agent" [defaultOpen]="true" storageKey="chat-debug-secondary-spec" />`,
    })
    class Host {
      agent = mockAgent({ state: { ready: true } });
    }

    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-label="Chat debug"]')).not.toBeNull();
  });
});
