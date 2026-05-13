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

  it('renders the collapse chevron in expanded mode with "Collapse sidenav" label', () => {
    const fixture = render({ mode: 'expanded' });
    const btn = fixture.nativeElement.querySelector('.chat-sidenav__action--collapse') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.getAttribute('aria-label')).toBe('Collapse sidenav');
  });

  it('renders the expand chevron in collapsed mode with "Expand sidenav" label', () => {
    const fixture = render({ mode: 'collapsed' });
    const btn = fixture.nativeElement.querySelector('.chat-sidenav__action--collapse') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.getAttribute('aria-label')).toBe('Expand sidenav');
  });

  it('omits the collapse chevron in drawer mode', () => {
    const fixture = render({ mode: 'drawer' });
    expect(fixture.nativeElement.querySelector('.chat-sidenav__action--collapse')).toBeNull();
  });

  it('clicking the chevron in expanded mode emits modeChange="collapsed"', () => {
    const fixture = render({ mode: 'expanded' });
    let last: string | undefined;
    fixture.componentInstance.modeChange.subscribe((m: string) => { last = m; });
    const btn = fixture.nativeElement.querySelector('.chat-sidenav__action--collapse') as HTMLButtonElement;
    btn.click();
    expect(last).toBe('collapsed');
  });

  it('clicking the chevron in collapsed mode emits modeChange="expanded"', () => {
    const fixture = render({ mode: 'collapsed' });
    let last: string | undefined;
    fixture.componentInstance.modeChange.subscribe((m: string) => { last = m; });
    const btn = fixture.nativeElement.querySelector('.chat-sidenav__action--collapse') as HTMLButtonElement;
    btn.click();
    expect(last).toBe('expanded');
  });

  it('Cmd+B in expanded mode emits modeChange="collapsed"', () => {
    const fixture = render({ mode: 'expanded' });
    let last: string | undefined;
    fixture.componentInstance.modeChange.subscribe((m: string) => { last = m; });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', metaKey: true }));
    expect(last).toBe('collapsed');
  });

  it('Cmd+B in collapsed mode emits modeChange="expanded"', () => {
    const fixture = render({ mode: 'collapsed' });
    let last: string | undefined;
    fixture.componentInstance.modeChange.subscribe((m: string) => { last = m; });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', metaKey: true }));
    expect(last).toBe('expanded');
  });

  it('Cmd+B is a no-op in drawer mode', () => {
    const fixture = render({ mode: 'drawer' });
    let emits = 0;
    fixture.componentInstance.modeChange.subscribe(() => { emits++; });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', metaKey: true }));
    expect(emits).toBe(0);
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

  it('projects=null renders no Projects section', () => {
    const fixture = render({ threads: [{ id: 't1' }] });
    expect(fixture.nativeElement.querySelector('.chat-sidenav__projects')).toBeNull();
  });

  it('projects=[p1,p2] renders the Projects section with two rows', () => {
    const fixture = render({ threads: [{ id: 't1' }] });
    fixture.componentRef.setInput('projects', [{ id: 'p1', name: 'Work' }, { id: 'p2', name: 'Personal' }]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.chat-sidenav__projects')).not.toBeNull();
    const rows = fixture.nativeElement.querySelectorAll('.chat-project-list__item');
    expect(rows.length).toBe(2);
  });

  it('selectedProjectId highlights the matching project row', () => {
    const fixture = render({ threads: [{ id: 't1' }] });
    fixture.componentRef.setInput('projects', [{ id: 'p1', name: 'Work' }, { id: 'p2', name: 'Personal' }]);
    fixture.componentRef.setInput('selectedProjectId', 'p2');
    fixture.detectChanges();
    const rows = fixture.nativeElement.querySelectorAll('.chat-project-list__item');
    expect(rows[0].getAttribute('data-active')).toBeNull();
    expect(rows[1].getAttribute('data-active')).toBe('true');
  });

  it('projectActions.create shows "+ New project" and emits newProjectRequested on click', () => {
    const fixture = render({ threads: [{ id: 't1' }] });
    fixture.componentRef.setInput('projects', []);
    fixture.componentRef.setInput('projectActions', { create: async () => ({ id: 'x' }) });
    fixture.detectChanges();
    let emits = 0;
    fixture.componentInstance.newProjectRequested.subscribe(() => { emits++; });
    const btn = fixture.nativeElement.querySelector('.chat-project-list__new') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    btn.click();
    fixture.detectChanges();
    expect(emits).toBe(1);
  });
});
