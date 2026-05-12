// libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.spec.ts
// SPDX-License-Identifier: MIT
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ChatSidenavComponent } from './chat-sidenav.component';

function render(opts: { mode?: 'expanded' | 'collapsed' | 'drawer'; open?: boolean; threads?: unknown[] | null } = {}) {
  const fixture = TestBed.createComponent(ChatSidenavComponent);
  if (opts.mode) fixture.componentRef.setInput('mode', opts.mode);
  if (opts.open !== undefined) fixture.componentRef.setInput('open', opts.open);
  if (opts.threads !== undefined) fixture.componentRef.setInput('threads', opts.threads);
  fixture.detectChanges();
  return fixture;
}

describe('ChatSidenavComponent', () => {
  it('reflects mode via data-mode attribute', () => {
    expect(render({ mode: 'expanded' }).nativeElement.getAttribute('data-mode')).toBe('expanded');
    expect(render({ mode: 'collapsed' }).nativeElement.getAttribute('data-mode')).toBe('collapsed');
    expect(render({ mode: 'drawer' }).nativeElement.getAttribute('data-mode')).toBe('drawer');
  });

  it('emits newChat when new-chat button clicked', () => {
    const fixture = render();
    let emits = 0;
    fixture.componentInstance.newChat.subscribe(() => emits++);
    const btn = fixture.nativeElement.querySelector('.chat-sidenav__action--new') as HTMLButtonElement;
    btn.click();
    expect(emits).toBe(1);
  });

  it('emits searchOpened when search button clicked', () => {
    const fixture = render();
    let emits = 0;
    fixture.componentInstance.searchOpened.subscribe(() => emits++);
    const btn = fixture.nativeElement.querySelector('.chat-sidenav__action--search') as HTMLButtonElement;
    btn.click();
    expect(emits).toBe(1);
  });

  it('emits searchOpened on Cmd+K', () => {
    const fixture = render();
    let emits = 0;
    fixture.componentInstance.searchOpened.subscribe(() => emits++);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
    expect(emits).toBe(1);
  });

  it('emits searchOpened on Ctrl+K', () => {
    const fixture = render();
    let emits = 0;
    fixture.componentInstance.searchOpened.subscribe(() => emits++);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    expect(emits).toBe(1);
  });

  it('does not emit searchOpened on Cmd+K when focus is in an input', () => {
    const fixture = render();
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    let emits = 0;
    fixture.componentInstance.searchOpened.subscribe(() => emits++);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
    expect(emits).toBe(0);
    document.body.removeChild(input);
  });

  it('renders threads section when threads input is non-null', () => {
    const fixture = render({ threads: [{ id: 't1', title: 'First' }] });
    expect(fixture.nativeElement.querySelector('chat-thread-list')).not.toBeNull();
  });

  it('suppresses threads section when threads input is null', () => {
    const fixture = render({ threads: null });
    expect(fixture.nativeElement.querySelector('chat-thread-list')).toBeNull();
  });

  it('drawer mode: scrim click emits openChange(false)', () => {
    const fixture = render({ mode: 'drawer', open: true });
    let lastOpen: boolean | undefined;
    fixture.componentInstance.openChange.subscribe((v: boolean) => { lastOpen = v; });
    const scrim = fixture.nativeElement.querySelector('.chat-sidenav__scrim') as HTMLButtonElement;
    scrim.click();
    expect(lastOpen).toBe(false);
  });

  it('drawer mode: scrim NOT rendered when open is false', () => {
    const fixture = render({ mode: 'drawer', open: false });
    expect(fixture.nativeElement.querySelector('.chat-sidenav__scrim')).toBeNull();
  });

  it('archivedThreads=null renders no archived heading', () => {
    const fixture = render({ threads: [{ id: 't1' }] });
    expect(fixture.nativeElement.querySelector('.chat-sidenav__archived')).toBeNull();
  });

  it('archivedThreads=[] renders the heading; clicking expands to show empty state', () => {
    const fixture = render({ threads: [{ id: 't1' }] });
    fixture.componentRef.setInput('archivedThreads', []);
    fixture.detectChanges();
    const heading = fixture.nativeElement.querySelector('.chat-sidenav__archived-heading') as HTMLButtonElement;
    expect(heading).not.toBeNull();
    expect(heading.getAttribute('aria-expanded')).toBe('false');
    heading.click();
    fixture.detectChanges();
    expect(heading.getAttribute('aria-expanded')).toBe('true');
    expect(fixture.nativeElement.querySelector('.chat-sidenav__archived-empty')).not.toBeNull();
  });

  it('archivedThreads=[t1,t2] renders the heading; expanding shows a chat-thread-list with mode="archived"', () => {
    const fixture = render({ threads: [{ id: 't1' }] });
    fixture.componentRef.setInput('archivedThreads', [{ id: 'a1', title: 'A1' }, { id: 'a2', title: 'A2' }]);
    fixture.detectChanges();
    const heading = fixture.nativeElement.querySelector('.chat-sidenav__archived-heading') as HTMLButtonElement;
    heading.click();
    fixture.detectChanges();
    const lists = fixture.nativeElement.querySelectorAll('chat-thread-list');
    expect(lists.length).toBe(2);
    expect(lists[1].getAttribute('mode')).toBe('archived');
  });

  it('clicking the archived heading toggles aria-expanded', () => {
    const fixture = render({ threads: [{ id: 't1' }] });
    fixture.componentRef.setInput('archivedThreads', []);
    fixture.detectChanges();
    const heading = fixture.nativeElement.querySelector('.chat-sidenav__archived-heading') as HTMLButtonElement;
    expect(heading.getAttribute('aria-expanded')).toBe('false');
    heading.click();
    fixture.detectChanges();
    expect(heading.getAttribute('aria-expanded')).toBe('true');
    heading.click();
    fixture.detectChanges();
    expect(heading.getAttribute('aria-expanded')).toBe('false');
  });
});
