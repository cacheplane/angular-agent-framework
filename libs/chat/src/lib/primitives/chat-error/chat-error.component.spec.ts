// SPDX-License-Identifier: MIT
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { extractErrorMessage, ChatErrorComponent } from './chat-error.component';
import { mockAgent } from '../../testing/mock-agent';
import { AgentError } from '../../agent/agent-error';
import type { MockAgent } from '../../testing/mock-agent';

describe('extractErrorMessage()', () => {
  it('returns null for null error', () => {
    expect(extractErrorMessage(null)).toBeNull();
  });

  it('returns null for undefined error', () => {
    expect(extractErrorMessage(undefined)).toBeNull();
  });

  it('extracts message from Error object', () => {
    expect(extractErrorMessage(new Error('something went wrong'))).toBe('something went wrong');
  });

  it('returns string errors as-is', () => {
    expect(extractErrorMessage('network failure')).toBe('network failure');
  });

  it('converts unknown values to string', () => {
    expect(extractErrorMessage(42)).toBe('42');
  });
});

@Component({
  standalone: true,
  imports: [ChatErrorComponent],
  template: `<chat-error [agent]="agent" />`,
})
class HostComponent {
  agent: MockAgent = mockAgent();
}

describe('ChatErrorComponent — rendering', () => {
  let host: HostComponent;
  let fixture: ReturnType<typeof TestBed.createComponent<HostComponent>>;

  beforeEach(() => {
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
  });

  it('renders err.message text for a retryable AgentError', () => {
    const err = new AgentError({ kind: 'server', message: 'The server ran into an error. You can try again.', retryable: true });
    host.agent = mockAgent({ status: 'error', error: err });
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const msg = el.querySelector('.chat-error__msg');
    expect(msg?.textContent?.trim()).toBe('The server ran into an error. You can try again.');
  });

  it('shows a Retry button when retryable is true', () => {
    const err = new AgentError({ kind: 'server', message: 'The server ran into an error. You can try again.', retryable: true });
    host.agent = mockAgent({ status: 'error', error: err });
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const btn = el.querySelector<HTMLButtonElement>('button.chat-error__retry');
    expect(btn).not.toBeNull();
    expect(btn?.textContent?.trim().toLowerCase()).toMatch(/retry/i);
  });

  it('hides the Retry button when retryable is false', () => {
    const err = new AgentError({ kind: 'auth', message: 'Authentication failed. Check your API key or credentials.', retryable: false });
    host.agent = mockAgent({ status: 'error', error: err });
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const btn = el.querySelector('button.chat-error__retry');
    expect(btn).toBeNull();
  });

  it('clicking Retry calls agent.retry()', async () => {
    const err = new AgentError({ kind: 'server', message: 'The server ran into an error. You can try again.', retryable: true });
    const agent = mockAgent({ status: 'error', error: err });
    const retrySpy = vi.spyOn(agent, 'retry');
    host.agent = agent;
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const btn = el.querySelector<HTMLButtonElement>('button.chat-error__retry');
    expect(btn).not.toBeNull();
    btn!.click();

    expect(retrySpy).toHaveBeenCalledTimes(1);
  });
});
