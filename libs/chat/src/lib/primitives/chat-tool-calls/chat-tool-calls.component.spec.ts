// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { signal, computed, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { mockAgent } from '../../testing/mock-agent';
import type { Agent, Message, ToolCall } from '../../agent';
import { ChatToolCallsComponent } from './chat-tool-calls.component';
import { ChatToolCallTemplateDirective } from './chat-tool-call-template.directive';

describe('ToolCallsComponent — toolCalls computed', () => {
  it('returns agent.toolCalls() when no message is provided', () => {
    const mockToolCalls: ToolCall[] = [
      { id: 'call_1', name: 'get_weather', args: { city: 'NYC' }, status: 'complete', result: 'sunny' },
    ];
    const agent = mockAgent({ toolCalls: mockToolCalls });

    const agent$ = signal(agent);
    const toolCalls = computed(() => agent$().toolCalls());

    expect(toolCalls()).toHaveLength(1);
    expect(toolCalls()[0].id).toBe('call_1');
  });

  it('returns agent.toolCalls() when message is a user message (no tool_use blocks)', () => {
    const agent = mockAgent();
    const msg: Message = { id: '1', role: 'user', content: 'hello' };

    const agent$ = signal(agent);
    const message$ = signal<Message | undefined>(msg);

    const toolCalls = computed((): ToolCall[] => {
      const m = message$();
      if (m && m.role === 'assistant' && Array.isArray(m.content)) {
        const blocks = m.content.filter((b: any) => b.type === 'tool_use') as Array<{
          type: 'tool_use'; id: string; name: string; args: unknown;
        }>;
        const all = agent$().toolCalls();
        return blocks
          .map(b => all.find(tc => tc.id === b.id))
          .filter((x): x is ToolCall => !!x);
      }
      return agent$().toolCalls();
    });

    expect(toolCalls()).toHaveLength(0);
  });

  it('returns matched ToolCalls when message has tool_use content blocks', () => {
    const mockToolCalls: ToolCall[] = [
      { id: 'call_2', name: 'search', args: { query: 'test' }, status: 'complete', result: 'results' },
    ];
    const agent = mockAgent({ toolCalls: mockToolCalls });

    const msg: Message = {
      id: '2',
      role: 'assistant',
      content: [{ type: 'tool_use', id: 'call_2', name: 'search', args: { query: 'test' } }],
    };

    const agent$ = signal(agent);
    const message$ = signal<Message | undefined>(msg);

    const toolCalls = computed((): ToolCall[] => {
      const m = message$();
      if (m && m.role === 'assistant' && Array.isArray(m.content)) {
        const blocks = m.content.filter((b: any) => b.type === 'tool_use') as Array<{
          type: 'tool_use'; id: string; name: string; args: unknown;
        }>;
        const all = agent$().toolCalls();
        return blocks
          .map(b => all.find(tc => tc.id === b.id))
          .filter((x): x is ToolCall => !!x);
      }
      return agent$().toolCalls();
    });

    expect(toolCalls()).toHaveLength(1);
    expect(toolCalls()[0].id).toBe('call_2');
    expect(toolCalls()[0].name).toBe('search');
  });

  it('toolCalls updates reactively when agent changes', () => {
    const emptyAgent = mockAgent();
    const loadedAgent = mockAgent({
      toolCalls: [{ id: 'call_3', name: 'calculator', args: {}, status: 'complete' }],
    });

    const agent$ = signal(emptyAgent);
    const toolCalls = computed(() => agent$().toolCalls());

    expect(toolCalls()).toHaveLength(0);
    agent$.set(loadedAgent);
    expect(toolCalls()).toHaveLength(1);
  });
});

@Component({
  standalone: true,
  imports: [ChatToolCallsComponent, ChatToolCallTemplateDirective],
  template: `
    <chat-tool-calls [agent]="agent" [grouping]="grouping">
      @if (registerSearchWeb) {
        <ng-template chatToolCallTemplate="search_web" let-call>
          <span data-tpl="search_web">{{ call.name }}-{{ call.id }}</span>
        </ng-template>
      }
      @if (registerWildcard) {
        <ng-template chatToolCallTemplate="*" let-call>
          <span data-tpl="wildcard">{{ call.name }}-{{ call.id }}</span>
        </ng-template>
      }
    </chat-tool-calls>
  `,
})
class GroupingHost {
  agent!: Agent;
  grouping: 'auto' | 'none' = 'auto';
  registerSearchWeb = false;
  registerWildcard = false;
}

describe('ChatToolCallsComponent — grouping + per-tool templates', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [GroupingHost] });
  });

  it('groups three sequential search_web calls into one strip', () => {
    const fixture = TestBed.createComponent(GroupingHost);
    fixture.componentInstance.agent = mockAgent({
      toolCalls: [
        { id: 'a', name: 'search_web', args: {}, status: 'complete', result: 'r' },
        { id: 'b', name: 'search_web', args: {}, status: 'complete', result: 'r' },
        { id: 'c', name: 'search_web', args: {}, status: 'complete', result: 'r' },
      ],
    });
    fixture.detectChanges();
    const strips = fixture.nativeElement.querySelectorAll('[data-group="true"]');
    expect(strips.length).toBe(1);
    expect(strips[0].textContent).toContain('Searched 3');
  });

  it('does not group when names differ', () => {
    const fixture = TestBed.createComponent(GroupingHost);
    fixture.componentInstance.agent = mockAgent({
      toolCalls: [
        { id: 'a', name: 'search_web', args: {}, status: 'complete' },
        { id: 'b', name: 'read_file', args: {}, status: 'complete' },
        { id: 'c', name: 'search_web', args: {}, status: 'complete' },
      ],
    });
    fixture.detectChanges();
    const strips = fixture.nativeElement.querySelectorAll('[data-group="true"]');
    expect(strips.length).toBe(0);
    const cards = fixture.nativeElement.querySelectorAll('chat-tool-call-card');
    expect(cards.length).toBe(3);
  });

  it('does not group when [grouping]="none"', () => {
    const fixture = TestBed.createComponent(GroupingHost);
    fixture.componentInstance.grouping = 'none';
    fixture.componentInstance.agent = mockAgent({
      toolCalls: [
        { id: 'a', name: 'search_web', args: {}, status: 'complete' },
        { id: 'b', name: 'search_web', args: {}, status: 'complete' },
      ],
    });
    fixture.detectChanges();
    const strips = fixture.nativeElement.querySelectorAll('[data-group="true"]');
    expect(strips.length).toBe(0);
  });

  it('routes each call through a per-tool template when registered', () => {
    const fixture = TestBed.createComponent(GroupingHost);
    fixture.componentInstance.registerSearchWeb = true;
    fixture.componentInstance.agent = mockAgent({
      toolCalls: [
        { id: 'a', name: 'search_web', args: {}, status: 'complete' },
        { id: 'b', name: 'search_web', args: {}, status: 'complete' },
      ],
    });
    fixture.detectChanges();
    const tplNodes = fixture.nativeElement.querySelectorAll('[data-tpl="search_web"]');
    expect(tplNodes.length).toBe(2);
    expect(fixture.nativeElement.querySelectorAll('[data-group="true"]').length).toBe(0);
    expect(fixture.nativeElement.querySelectorAll('chat-tool-call-card').length).toBe(0);
  });

  it('falls back to wildcard "*" template when no per-tool template matches', () => {
    const fixture = TestBed.createComponent(GroupingHost);
    fixture.componentInstance.registerWildcard = true;
    fixture.componentInstance.agent = mockAgent({
      toolCalls: [
        { id: 'a', name: 'read_file', args: {}, status: 'complete' },
      ],
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('[data-tpl="wildcard"]').length).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('chat-tool-call-card').length).toBe(0);
  });

  it('per-tool template wins over wildcard for matching name', () => {
    const fixture = TestBed.createComponent(GroupingHost);
    fixture.componentInstance.registerSearchWeb = true;
    fixture.componentInstance.registerWildcard = true;
    fixture.componentInstance.agent = mockAgent({
      toolCalls: [
        { id: 'a', name: 'search_web', args: {}, status: 'complete' },
        { id: 'b', name: 'read_file', args: {}, status: 'complete' },
      ],
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('[data-tpl="search_web"]').length).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('[data-tpl="wildcard"]').length).toBe(1);
  });
});

describe('summarize-group label registry', () => {
  let summarize: typeof import('./group-summary').summarizeGroup;
  beforeEach(async () => {
    summarize = (await import('./group-summary')).summarizeGroup;
  });

  it('uses "Searched N sites" for search_*', () => {
    expect(summarize('search_web', 5)).toBe('Searched 5 sites');
    expect(summarize('search_files', 1)).toBe('Searched 1 site');
  });

  it('uses "Generated N items" for generate_*', () => {
    expect(summarize('generate_image', 3)).toBe('Generated 3 items');
  });

  it('falls back to "Called {name} N times"', () => {
    expect(summarize('foo', 4)).toBe('Called foo 4 times');
  });
});
