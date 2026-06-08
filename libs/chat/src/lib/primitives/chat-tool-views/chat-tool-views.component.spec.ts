// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { views } from '@threadplane/render';
import { mockAgent, type MockAgent } from '../../testing/mock-agent';
import type { Message, ToolCall } from '../../agent';
import { ChatToolViewsComponent } from './chat-tool-views.component';

// A minimal view component that renders the props it receives so the test
// can assert which fields reached it.
@Component({
  selector: 'chat-test-weather-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="loc">{{ location() }}</div><div class="temp">{{ temperatureF() }}</div><div class="st">{{ status() }}</div>`,
})
class TestWeatherCardComponent {
  readonly location = input<string | undefined>(undefined);
  readonly temperatureF = input<number | undefined>(undefined);
  readonly status = input<string | undefined>(undefined);
}

function mountHost(agent: MockAgent, message: Message | undefined) {
  @Component({
    standalone: true,
    imports: [ChatToolViewsComponent],
    template: `<chat-tool-views [agent]="agent" [message]="message" [views]="reg" />`,
  })
  class HostComponent {
    readonly agent = agent;
    readonly message = message;
    readonly reg = views({ weather_card: TestWeatherCardComponent });
  }
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  return fixture;
}

describe('ChatToolViewsComponent', () => {
  let agent: MockAgent;
  const msg: Message = { id: 'm1', role: 'assistant', content: '', toolCallIds: ['c1'] };

  beforeEach(() => {
    agent = mockAgent();
  });

  it('mounts the registered view for a matching tool name and passes running args + status', () => {
    agent.toolCalls.set([
      { id: 'c1', name: 'weather_card', args: { location: 'San Francisco' }, status: 'running' },
    ] as ToolCall[]);
    const fixture = mountHost(agent, msg);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('chat-test-weather-card')).toBeTruthy();
    expect(el.querySelector('.loc')?.textContent).toContain('San Francisco');
    expect(el.querySelector('.st')?.textContent).toContain('running');
  });

  it('merges result fields on completion', () => {
    agent.toolCalls.set([
      {
        id: 'c1', name: 'weather_card',
        args: { location: 'San Francisco' },
        status: 'complete',
        result: { location: 'San Francisco', temperatureF: 68, conditions: 'Sunny' },
      },
    ] as ToolCall[]);
    const fixture = mountHost(agent, msg);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.temp')?.textContent).toContain('68');
    expect(el.querySelector('.st')?.textContent).toContain('complete');
  });

  it('renders nothing for an unregistered tool name', () => {
    agent.toolCalls.set([
      { id: 'c1', name: 'lookup_flight', args: { flight: 'UA1' }, status: 'complete', result: {} },
    ] as ToolCall[]);
    const fixture = mountHost(agent, msg);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('chat-test-weather-card')).toBeNull();
  });

  it('renders nothing when views is undefined', () => {
    agent.toolCalls.set([
      { id: 'c1', name: 'weather_card', args: {}, status: 'running' },
    ] as ToolCall[]);

    @Component({
      standalone: true,
      imports: [ChatToolViewsComponent],
      template: `<chat-tool-views [agent]="agent" [message]="message" />`,
    })
    class BareHost {
      readonly agent = agent;
      readonly message = msg;
    }
    const fixture = TestBed.createComponent(BareHost);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('chat-test-weather-card')).toBeNull();
  });
});
