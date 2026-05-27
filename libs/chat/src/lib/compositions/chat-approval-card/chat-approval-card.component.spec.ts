// SPDX-License-Identifier: MIT
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { ChatApprovalCardComponent } from './chat-approval-card.component';
import { mockAgent } from '../../testing/mock-agent';
import type { AgentInterrupt } from '../../agent/agent-interrupt';

@Component({
  standalone: true,
  imports: [ChatApprovalCardComponent],
  template: `
    <chat-approval-card
      [agent]="agent"
      [matchKind]="matchKind"
      [showEdit]="showEdit"
      (action)="lastAction = $event"
    >
      <ng-template #body let-payload>
        <span class="amount">{{ payload.amount }}</span>
        <span class="customer">{{ payload.customer_id }}</span>
      </ng-template>
    </chat-approval-card>
  `,
})
class HostComponent {
  agent = mockAgent({ withInterrupt: true });
  matchKind: string | undefined = undefined;
  showEdit = false;
  lastAction: string | undefined = undefined;
}

describe('ChatApprovalCardComponent', () => {
  let host: HostComponent;
  let fixture: ReturnType<typeof TestBed.createComponent<HostComponent>>;

  beforeEach(() => {
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
  });

  it('renders the projected body template with payload bound', () => {
    const interrupt: AgentInterrupt = {
      id: 'int-1',
      value: { kind: 'refund_approval', amount: 47.5, customer_id: 'cus_a8x2k' },
      resumable: true,
    };
    host.agent.interrupt!.set(interrupt);
    fixture.detectChanges();

    const amount = fixture.nativeElement.querySelector('.amount')?.textContent?.trim();
    const customer = fixture.nativeElement.querySelector('.customer')?.textContent?.trim();
    expect(amount).toBe('47.5');
    expect(customer).toBe('cus_a8x2k');
  });

  it('renders body when matchKind matches the interrupt kind', () => {
    host.matchKind = 'refund_approval';
    host.agent.interrupt!.set({
      id: 'int-1',
      value: { kind: 'refund_approval', amount: 47.5, customer_id: 'cus_a' },
      resumable: true,
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.amount')?.textContent?.trim()).toBe('47.5');
  });

  it('renders nothing when matchKind does not match', () => {
    host.matchKind = 'refund_approval';
    host.agent.interrupt!.set({
      id: 'int-2',
      value: { kind: 'delete_approval', target: 'user_42' },
      resumable: true,
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.amount')).toBeNull();
  });

  it('emits "approve" when the Approve button is clicked', () => {
    host.agent.interrupt!.set({
      id: 'int-3',
      value: { kind: 'refund_approval', amount: 10, customer_id: 'cus_a' },
      resumable: true,
    });
    fixture.detectChanges();
    const approve = fixture.nativeElement.querySelector('.btn-primary') as HTMLButtonElement;
    approve.click();
    expect(host.lastAction).toBe('approve');
  });

  it('emits "cancel" when the Cancel button is clicked', () => {
    host.agent.interrupt!.set({
      id: 'int-4',
      value: { kind: 'refund_approval', amount: 10, customer_id: 'cus_a' },
      resumable: true,
    });
    fixture.detectChanges();
    const cancel = fixture.nativeElement.querySelector('.btn-text') as HTMLButtonElement;
    cancel.click();
    expect(host.lastAction).toBe('cancel');
  });

  it('hides the Edit button when showEdit is false', () => {
    host.showEdit = false;
    host.agent.interrupt!.set({
      id: 'int-5',
      value: { kind: 'refund_approval', amount: 10, customer_id: 'cus_a' },
      resumable: true,
    });
    fixture.detectChanges();
    const editButtons = fixture.nativeElement.querySelectorAll('button.btn-secondary');
    expect(editButtons.length).toBe(0);
  });

  it('shows the Edit button and emits "edit" when showEdit is true', () => {
    host.showEdit = true;
    host.agent.interrupt!.set({
      id: 'int-6',
      value: { kind: 'refund_approval', amount: 10, customer_id: 'cus_a' },
      resumable: true,
    });
    fixture.detectChanges();
    const edit = fixture.nativeElement.querySelector('.btn-secondary') as HTMLButtonElement;
    expect(edit).not.toBeNull();
    edit.click();
    expect(host.lastAction).toBe('edit');
  });
});
