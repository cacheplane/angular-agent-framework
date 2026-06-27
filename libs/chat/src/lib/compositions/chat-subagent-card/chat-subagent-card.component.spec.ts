// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ChatSubagentCardComponent, statusColor } from './chat-subagent-card.component';
import type { Subagent } from '../../agent/subagent';

describe('ChatSubagentCardComponent', () => {
  it('is defined', () => {
    expect(ChatSubagentCardComponent).toBeDefined();
    expect(typeof ChatSubagentCardComponent).toBe('function');
  });

  it('renders full transcript with reasoning, text, and tool-call cards', async () => {
    const fakeSubagent: Subagent = {
      toolCallId: 'tc-root',
      name: 'Research',
      // Use 'running' so chat-trace auto-expands and the transcript DOM is rendered.
      status: signal('running'),
      messages: signal([
        {
          id: 'm1',
          role: 'assistant',
          content: 'searching',
          reasoning: 'plan',
          toolCallIds: ['t1'],
        },
        {
          id: 'm2',
          role: 'assistant',
          content: 'done',
        },
      ]),
      toolCalls: signal([
        { id: 't1', name: 'search', args: { q: 'x' }, status: 'complete', result: { n: 1 } },
      ]),
      state: signal({}),
    };

    TestBed.configureTestingModule({
      imports: [ChatSubagentCardComponent],
    });

    const fixture = TestBed.createComponent(ChatSubagentCardComponent);
    fixture.componentRef.setInput('subagent', fakeSubagent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const msgEls = fixture.debugElement.queryAll(By.css('.sac__msg'));
    expect(msgEls.length).toBe(2);

    const text = host.textContent ?? '';
    expect(text).toContain('searching');
    expect(text).toContain('done');
    expect(text).toContain('plan');

    const toolCallEls = fixture.debugElement.queryAll(By.css('chat-tool-call-card'));
    expect(toolCallEls.length).toBe(1);
  });

  it('shows the message count in the collapsed summary when complete', async () => {
    const fakeSubagent: Subagent = {
      toolCallId: 'tc-root',
      name: 'Research',
      // 'complete' → chat-trace collapses; the transcript DOM is hidden.
      status: signal('complete'),
      messages: signal([
        { id: 'm1', role: 'assistant', content: 'a' },
        { id: 'm2', role: 'assistant', content: 'b' },
      ]),
      toolCalls: signal([]),
      state: signal({}),
    };

    TestBed.configureTestingModule({
      imports: [ChatSubagentCardComponent],
    });

    const fixture = TestBed.createComponent(ChatSubagentCardComponent);
    fixture.componentRef.setInput('subagent', fakeSubagent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // Collapsed: the per-message transcript must NOT be rendered.
    const msgEls = fixture.debugElement.queryAll(By.css('.sac__msg'));
    expect(msgEls.length).toBe(0);

    // ...but the count lives in the always-visible meta slot.
    const host = fixture.nativeElement as HTMLElement;
    const text = host.textContent ?? '';
    expect(text).toMatch(/2 message/);
  });
});

describe('statusColor', () => {
  it('returns muted style for pending', () => {
    expect(statusColor('pending')).toContain('var(--tplane-chat-text-muted)');
  });

  it('returns warning style for running', () => {
    expect(statusColor('running')).toContain('var(--tplane-chat-warning-text)');
  });

  it('returns success style for complete', () => {
    expect(statusColor('complete')).toContain('var(--tplane-chat-success)');
  });

  it('returns error style for error', () => {
    expect(statusColor('error')).toContain('var(--tplane-chat-error-text)');
  });
});
