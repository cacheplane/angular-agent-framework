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

  it('merges markdown sidecar citations when resolver is available — bug #197 regression', async () => {
    // Live Chrome smoke caught: when citations come from Pandoc-formatted
    // [^id]: defs in content (no provider metadata), inline markers resolved
    // correctly via the markdown sidecar but the sources panel never rendered.
    const { CitationsResolverService } = await import('../../markdown/citations-resolver.service');
    @Component({
      standalone: true,
      imports: [ChatCitationsComponent],
      providers: [CitationsResolverService],
      template: `<chat-citations [message]="message" />`,
    })
    class ResolverHost {
      message: Message = msg(undefined); // no provider citations
    }
    const fixture = TestBed.createComponent(ResolverHost);
    const resolver = fixture.debugElement.injector.get(CitationsResolverService);
    resolver.markdownDefs.set(new Map([
      ['src1', {
        id: 'src1', index: 1, status: 'complete',
        children: [
          { id: 1, type: 'text', status: 'complete', parent: null, index: 0, text: 'Wikipedia ' },
          { id: 2, type: 'autolink', status: 'complete', parent: null, index: 1,
            url: 'https://en.wikipedia.org/wiki/Coral_reef',
            text: 'https://en.wikipedia.org/wiki/Coral_reef' },
        ],
      } as never],
    ]));
    fixture.detectChanges();
    const cards = fixture.nativeElement.querySelectorAll('.chat-citations-card');
    expect(cards.length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('Wikipedia');
  });

  it('Message.citations takes precedence over markdown sidecar when ids overlap', async () => {
    const { CitationsResolverService } = await import('../../markdown/citations-resolver.service');
    @Component({
      standalone: true,
      imports: [ChatCitationsComponent],
      providers: [CitationsResolverService],
      template: `<chat-citations [message]="message" />`,
    })
    class PrecedenceHost {
      message: Message = msg([{ id: 'src1', index: 1, title: 'From message' }]);
    }
    const fixture = TestBed.createComponent(PrecedenceHost);
    const resolver = fixture.debugElement.injector.get(CitationsResolverService);
    resolver.markdownDefs.set(new Map([
      ['src1', { id: 'src1', index: 1, status: 'complete',
        children: [{ id: 1, type: 'text', status: 'complete', parent: null, index: 0, text: 'From markdown' }],
      } as never],
    ]));
    fixture.detectChanges();
    const cards = fixture.nativeElement.querySelectorAll('.chat-citations-card');
    expect(cards.length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('From message');
    expect(fixture.nativeElement.textContent).not.toContain('From markdown');
  });
});
