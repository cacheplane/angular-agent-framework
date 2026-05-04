// libs/chat/src/lib/primitives/chat-citations/chat-citations.component.spec.ts
// SPDX-License-Identifier: MIT
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ChatCitationsComponent, ChatCitationCardTemplateDirective } from './chat-citations.component';
import type { Message } from '../../agent/message';

function msg(citations: Message['citations']): Message {
  return { id: 'm1', role: 'assistant', content: 'x', citations };
}

@Component({
  standalone: true,
  imports: [ChatCitationsComponent],
  template: `<chat-citations [message]="message()" />`,
})
class HostComponent {
  message = signal<Message>(msg(undefined));
}

describe('ChatCitationsComponent', () => {
  it('renders nothing when citations is undefined', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.chat-citations')).toBeNull();
  });

  it('renders nothing when citations is empty', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.message.set(msg([]));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.chat-citations')).toBeNull();
  });

  it('renders citations sorted by index', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.message.set(msg([
      { id: 'b', index: 2, title: 'B' },
      { id: 'a', index: 1, title: 'A' },
    ]));
    fixture.detectChanges();
    const titles = Array.from(fixture.nativeElement.querySelectorAll('.chat-citations-card__title'))
      .map((el: any) => el.textContent.trim());
    expect(titles).toEqual(['A', 'B']);
  });

  it('uses ContentChild template slot when provided', () => {
    @Component({
      standalone: true,
      imports: [ChatCitationsComponent, ChatCitationCardTemplateDirective],
      template: `
        <chat-citations [message]="message">
          <ng-template chatCitationCard let-c>
            <span class="custom-card">{{ c.title }}</span>
          </ng-template>
        </chat-citations>
      `,
    })
    class CustomHost {
      message: Message = msg([{ id: 'a', index: 1, title: 'Custom' }]);
    }
    const fixture = TestBed.createComponent(CustomHost);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.custom-card')?.textContent.trim()).toBe('Custom');
    expect(fixture.nativeElement.querySelector('.chat-citations-card')).toBeNull();
  });
});
