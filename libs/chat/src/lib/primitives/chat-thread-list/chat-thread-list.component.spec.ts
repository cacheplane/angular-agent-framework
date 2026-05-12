// libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.spec.ts
// SPDX-License-Identifier: MIT
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import {
  ChatThreadListComponent,
  type Thread,
  type ThreadActionAdapter,
} from './chat-thread-list.component';

const noop = vi.fn().mockResolvedValue(undefined);

function render(opts: { threads?: Thread[]; actions?: ThreadActionAdapter | null; activeThreadId?: string } = {}) {
  const fixture = TestBed.createComponent(ChatThreadListComponent);
  fixture.componentRef.setInput('threads', opts.threads ?? [{ id: 't1', title: 'First' }, { id: 't2', title: 'Second' }]);
  if (opts.actions !== undefined) fixture.componentRef.setInput('actions', opts.actions);
  if (opts.activeThreadId !== undefined) fixture.componentRef.setInput('activeThreadId', opts.activeThreadId);
  fixture.detectChanges();
  return fixture;
}

describe('ChatThreadListComponent', () => {
  describe('without adapter', () => {
    it('renders the thread rows', () => {
      const fixture = render();
      const items = fixture.nativeElement.querySelectorAll('.chat-thread-list__item');
      expect(items.length).toBe(2);
    });

    it('clicking a row emits threadSelected', () => {
      const fixture = render();
      let received: string | undefined;
      fixture.componentInstance.threadSelected.subscribe((id: string) => { received = id; });
      const items = fixture.nativeElement.querySelectorAll('.chat-thread-list__item');
      (items[1] as HTMLElement).click();
      expect(received).toBe('t2');
    });

    it('renders no kebab when actions is null', () => {
      const fixture = render({ actions: null });
      expect(fixture.nativeElement.querySelector('.chat-thread-list__kebab')).toBeNull();
    });

    it('renders no kebab when actions is empty object', () => {
      const fixture = render({ actions: {} });
      expect(fixture.nativeElement.querySelector('.chat-thread-list__kebab')).toBeNull();
    });
  });

  describe('with adapter', () => {
    it('renders a kebab per row when adapter has methods', () => {
      const fixture = render({ actions: { delete: noop, rename: noop } });
      const kebabs = fixture.nativeElement.querySelectorAll('.chat-thread-list__kebab');
      expect(kebabs.length).toBe(2);
    });

    it('clicking kebab opens menu with both items when both methods provided', () => {
      const fixture = render({ actions: { delete: noop, rename: noop } });
      const kebab = fixture.nativeElement.querySelector('.chat-thread-list__kebab') as HTMLElement;
      kebab.click();
      fixture.detectChanges();
      const items = document.querySelectorAll('.chat-overflow-menu__item');
      const labels = Array.from(items).map((el) => (el as HTMLElement).textContent?.trim());
      expect(labels).toContain('Rename');
      expect(labels).toContain('Delete');
    });

    it('clicking Rename enters edit mode and focuses the input', async () => {
      const fixture = render({ actions: { rename: noop } });
      const kebab = fixture.nativeElement.querySelector('.chat-thread-list__kebab') as HTMLElement;
      kebab.click();
      fixture.detectChanges();
      const renameItem = Array.from(document.querySelectorAll('.chat-overflow-menu__item')).find((el) => (el as HTMLElement).textContent?.trim() === 'Rename') as HTMLElement;
      renameItem.click();
      fixture.detectChanges();
      await new Promise((r) => queueMicrotask(() => r(undefined)));
      fixture.detectChanges();
      const input = fixture.nativeElement.querySelector('.chat-thread-list__edit') as HTMLInputElement;
      expect(input).not.toBeNull();
      expect(input.value).toBe('First');
    });

    it('Enter on rename input calls adapter.rename and shows new title optimistically', async () => {
      const renameSpy = vi.fn().mockResolvedValue(undefined);
      const fixture = render({ actions: { rename: renameSpy } });
      (fixture.nativeElement.querySelector('.chat-thread-list__kebab') as HTMLElement).click();
      fixture.detectChanges();
      const renameItem = Array.from(document.querySelectorAll('.chat-overflow-menu__item')).find((el) => (el as HTMLElement).textContent?.trim() === 'Rename') as HTMLElement;
      renameItem.click();
      fixture.detectChanges();
      await new Promise((r) => queueMicrotask(() => r(undefined)));
      fixture.detectChanges();
      const input = fixture.nativeElement.querySelector('.chat-thread-list__edit') as HTMLInputElement;
      input.value = 'Renamed';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await new Promise((r) => setTimeout(r, 0));
      fixture.detectChanges();
      expect(renameSpy).toHaveBeenCalledWith('t1', 'Renamed');
    });

    it('Esc cancels rename without calling adapter', () => {
      const renameSpy = vi.fn().mockResolvedValue(undefined);
      const fixture = render({ actions: { rename: renameSpy } });
      (fixture.nativeElement.querySelector('.chat-thread-list__kebab') as HTMLElement).click();
      fixture.detectChanges();
      const renameItem = Array.from(document.querySelectorAll('.chat-overflow-menu__item')).find((el) => (el as HTMLElement).textContent?.trim() === 'Rename') as HTMLElement;
      renameItem.click();
      fixture.detectChanges();
      const input = fixture.nativeElement.querySelector('.chat-thread-list__edit') as HTMLInputElement;
      input.value = 'X';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();
      expect(renameSpy).not.toHaveBeenCalled();
    });

    it('Delete menu item opens the confirm dialog', () => {
      const fixture = render({ actions: { delete: noop } });
      (fixture.nativeElement.querySelector('.chat-thread-list__kebab') as HTMLElement).click();
      fixture.detectChanges();
      const delItem = Array.from(document.querySelectorAll('.chat-overflow-menu__item')).find((el) => (el as HTMLElement).textContent?.trim() === 'Delete') as HTMLElement;
      delItem.click();
      fixture.detectChanges();
      expect(document.querySelector('.chat-confirm-dialog')).not.toBeNull();
    });

    it('Confirming delete calls adapter and hides the row optimistically', async () => {
      let resolveDelete!: () => void;
      const deleteSpy = vi.fn(() => new Promise<void>((r) => { resolveDelete = r; }));
      const fixture = render({ actions: { delete: deleteSpy } });
      (fixture.nativeElement.querySelector('.chat-thread-list__kebab') as HTMLElement).click();
      fixture.detectChanges();
      const delItem = Array.from(document.querySelectorAll('.chat-overflow-menu__item')).find((el) => (el as HTMLElement).textContent?.trim() === 'Delete') as HTMLElement;
      delItem.click();
      fixture.detectChanges();
      (document.querySelector('.chat-confirm-dialog__confirm') as HTMLElement).click();
      fixture.detectChanges();
      const remaining = fixture.nativeElement.querySelectorAll('.chat-thread-list__item');
      expect(remaining.length).toBe(1);
      expect(deleteSpy).toHaveBeenCalledWith('t1');
      resolveDelete();
      await new Promise((r) => setTimeout(r, 0));
    });

    it('Cancelling the confirm dialog does not call adapter', () => {
      const deleteSpy = vi.fn().mockResolvedValue(undefined);
      const fixture = render({ actions: { delete: deleteSpy } });
      (fixture.nativeElement.querySelector('.chat-thread-list__kebab') as HTMLElement).click();
      fixture.detectChanges();
      const delItem = Array.from(document.querySelectorAll('.chat-overflow-menu__item')).find((el) => (el as HTMLElement).textContent?.trim() === 'Delete') as HTMLElement;
      delItem.click();
      fixture.detectChanges();
      (document.querySelector('.chat-confirm-dialog__cancel') as HTMLElement).click();
      fixture.detectChanges();
      expect(deleteSpy).not.toHaveBeenCalled();
    });

    it('Rename: when adapter rejects, the title reverts after settle', async () => {
      const renameSpy = vi.fn(async () => { throw new Error('boom'); });
      const fixture = render({ actions: { rename: renameSpy } });
      (fixture.nativeElement.querySelector('.chat-thread-list__kebab') as HTMLElement).click();
      fixture.detectChanges();
      const renameItem = Array.from(document.querySelectorAll('.chat-overflow-menu__item'))
        .find((el) => (el as HTMLElement).textContent?.trim() === 'Rename') as HTMLElement;
      renameItem.click();
      fixture.detectChanges();
      await new Promise((r) => queueMicrotask(() => r(undefined)));
      fixture.detectChanges();
      const input = fixture.nativeElement.querySelector('.chat-thread-list__edit') as HTMLInputElement;
      input.value = 'BadRename';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      // Wait for the rejection + finally clear to settle.
      await new Promise((r) => setTimeout(r, 0));
      await new Promise((r) => setTimeout(r, 0));
      fixture.detectChanges();
      // The visible title should be back to the original (the pending override has been cleared).
      const firstItemTitle = fixture.nativeElement.querySelectorAll('.chat-thread-list__item-title')[0] as HTMLElement;
      expect(firstItemTitle.textContent?.trim()).toBe('First');
      expect(renameSpy).toHaveBeenCalledWith('t1', 'BadRename');
    });

    it('Delete: when adapter rejects, the hidden row reappears', async () => {
      const deleteSpy = vi.fn(async () => { throw new Error('boom'); });
      const fixture = render({ actions: { delete: deleteSpy } });
      (fixture.nativeElement.querySelector('.chat-thread-list__kebab') as HTMLElement).click();
      fixture.detectChanges();
      const delItem = Array.from(document.querySelectorAll('.chat-overflow-menu__item'))
        .find((el) => (el as HTMLElement).textContent?.trim() === 'Delete') as HTMLElement;
      delItem.click();
      fixture.detectChanges();
      (document.querySelector('.chat-confirm-dialog__confirm') as HTMLElement).click();
      fixture.detectChanges();
      // Wait for the rejection + finally clear to settle.
      await new Promise((r) => setTimeout(r, 0));
      await new Promise((r) => setTimeout(r, 0));
      fixture.detectChanges();
      const remaining = fixture.nativeElement.querySelectorAll('.chat-thread-list__item');
      expect(remaining.length).toBe(2);
      expect(deleteSpy).toHaveBeenCalledWith('t1');
    });

    it('mode="active" with archive action shows Archive in menu', () => {
      const fixture = render({ actions: { archive: vi.fn().mockResolvedValue(undefined) } });
      (fixture.nativeElement.querySelector('.chat-thread-list__kebab') as HTMLElement).click();
      fixture.detectChanges();
      const labels = Array.from(document.querySelectorAll('.chat-overflow-menu__item'))
        .map((el) => (el as HTMLElement).textContent?.trim());
      expect(labels).toContain('Archive');
      expect(labels).not.toContain('Unarchive');
    });

    it('mode="archived" with unarchive action shows Unarchive (and not Rename or Archive)', () => {
      const fixture = TestBed.createComponent(ChatThreadListComponent);
      fixture.componentRef.setInput('threads', [{ id: 't1', title: 'First', status: 'archived' as const }]);
      fixture.componentRef.setInput('actions', { unarchive: vi.fn().mockResolvedValue(undefined), rename: vi.fn().mockResolvedValue(undefined), archive: vi.fn().mockResolvedValue(undefined) });
      fixture.componentRef.setInput('mode', 'archived');
      fixture.detectChanges();
      (fixture.nativeElement.querySelector('.chat-thread-list__kebab') as HTMLElement).click();
      fixture.detectChanges();
      const labels = Array.from(document.querySelectorAll('.chat-overflow-menu__item'))
        .map((el) => (el as HTMLElement).textContent?.trim());
      expect(labels).toEqual(['Unarchive']);
    });

    it('mode="archived" with unarchive + delete shows Unarchive, Delete in that order', () => {
      const fixture = TestBed.createComponent(ChatThreadListComponent);
      fixture.componentRef.setInput('threads', [{ id: 't1', title: 'First', status: 'archived' as const }]);
      fixture.componentRef.setInput('actions', { unarchive: vi.fn().mockResolvedValue(undefined), delete: vi.fn().mockResolvedValue(undefined) });
      fixture.componentRef.setInput('mode', 'archived');
      fixture.detectChanges();
      (fixture.nativeElement.querySelector('.chat-thread-list__kebab') as HTMLElement).click();
      fixture.detectChanges();
      const items = document.querySelectorAll('.chat-overflow-menu__item');
      expect(items.length).toBe(2);
      expect((items[0] as HTMLElement).textContent?.trim()).toBe('Unarchive');
      expect((items[1] as HTMLElement).textContent?.trim()).toBe('Delete');
      expect(items[1].classList.contains('chat-overflow-menu__item--destructive')).toBe(true);
    });

    it('Click Archive calls adapter.archive, hides row optimistically, no confirm dialog opens', async () => {
      let resolveArchive!: () => void;
      const archiveSpy = vi.fn(() => new Promise<void>((r) => { resolveArchive = r; }));
      const fixture = render({ actions: { archive: archiveSpy } });
      (fixture.nativeElement.querySelector('.chat-thread-list__kebab') as HTMLElement).click();
      fixture.detectChanges();
      const item = Array.from(document.querySelectorAll('.chat-overflow-menu__item'))
        .find((el) => (el as HTMLElement).textContent?.trim() === 'Archive') as HTMLElement;
      item.click();
      fixture.detectChanges();
      expect(archiveSpy).toHaveBeenCalledWith('t1');
      expect(document.querySelector('.chat-confirm-dialog')).toBeNull();
      const remaining = fixture.nativeElement.querySelectorAll('.chat-thread-list__item');
      expect(remaining.length).toBe(1);
      resolveArchive();
      await new Promise((r) => setTimeout(r, 0));
    });

    it('Click Unarchive calls adapter.unarchive and hides row optimistically', async () => {
      let resolveUnarchive!: () => void;
      const unarchiveSpy = vi.fn(() => new Promise<void>((r) => { resolveUnarchive = r; }));
      const fixture = TestBed.createComponent(ChatThreadListComponent);
      fixture.componentRef.setInput('threads', [
        { id: 't1', title: 'First', status: 'archived' as const },
        { id: 't2', title: 'Second', status: 'archived' as const },
      ]);
      fixture.componentRef.setInput('actions', { unarchive: unarchiveSpy });
      fixture.componentRef.setInput('mode', 'archived');
      fixture.detectChanges();
      (fixture.nativeElement.querySelector('.chat-thread-list__kebab') as HTMLElement).click();
      fixture.detectChanges();
      const item = Array.from(document.querySelectorAll('.chat-overflow-menu__item'))
        .find((el) => (el as HTMLElement).textContent?.trim() === 'Unarchive') as HTMLElement;
      item.click();
      fixture.detectChanges();
      expect(unarchiveSpy).toHaveBeenCalledWith('t1');
      const remaining = fixture.nativeElement.querySelectorAll('.chat-thread-list__item');
      expect(remaining.length).toBe(1);
      resolveUnarchive();
      await new Promise((r) => setTimeout(r, 0));
    });

    it('Archive: when adapter rejects, the hidden row reappears', async () => {
      const archiveSpy = vi.fn(async () => { throw new Error('boom'); });
      const fixture = render({ actions: { archive: archiveSpy } });
      (fixture.nativeElement.querySelector('.chat-thread-list__kebab') as HTMLElement).click();
      fixture.detectChanges();
      const item = Array.from(document.querySelectorAll('.chat-overflow-menu__item'))
        .find((el) => (el as HTMLElement).textContent?.trim() === 'Archive') as HTMLElement;
      item.click();
      await new Promise((r) => setTimeout(r, 0));
      await new Promise((r) => setTimeout(r, 0));
      fixture.detectChanges();
      const remaining = fixture.nativeElement.querySelectorAll('.chat-thread-list__item');
      expect(remaining.length).toBe(2);
    });

    it('Unarchive: when adapter rejects, the hidden row reappears', async () => {
      const unarchiveSpy = vi.fn(async () => { throw new Error('boom'); });
      const fixture = TestBed.createComponent(ChatThreadListComponent);
      fixture.componentRef.setInput('threads', [
        { id: 't1', title: 'First', status: 'archived' as const },
        { id: 't2', title: 'Second', status: 'archived' as const },
      ]);
      fixture.componentRef.setInput('actions', { unarchive: unarchiveSpy });
      fixture.componentRef.setInput('mode', 'archived');
      fixture.detectChanges();
      (fixture.nativeElement.querySelector('.chat-thread-list__kebab') as HTMLElement).click();
      fixture.detectChanges();
      const item = Array.from(document.querySelectorAll('.chat-overflow-menu__item'))
        .find((el) => (el as HTMLElement).textContent?.trim() === 'Unarchive') as HTMLElement;
      item.click();
      await new Promise((r) => setTimeout(r, 0));
      await new Promise((r) => setTimeout(r, 0));
      fixture.detectChanges();
      const remaining = fixture.nativeElement.querySelectorAll('.chat-thread-list__item');
      expect(remaining.length).toBe(2);
    });

    it('Pin: action provided + row not pinned → menu includes "Pin"', () => {
      const fixture = render({ actions: { pin: noop } });
      (fixture.nativeElement.querySelector('.chat-thread-list__kebab') as HTMLElement).click();
      fixture.detectChanges();
      const labels = Array.from(document.querySelectorAll('.chat-overflow-menu__item'))
        .map((el) => (el as HTMLElement).textContent?.trim());
      expect(labels).toContain('Pin');
      expect(labels).not.toContain('Unpin');
    });

    it('Pin: action provided + row pinned → menu does NOT include "Pin" (and no Unpin since unpin not provided)', () => {
      const fixture = render({
        threads: [{ id: 't1', title: 'First', pinned: true }, { id: 't2', title: 'Second' }],
        actions: { pin: noop },
      });
      (fixture.nativeElement.querySelector('.chat-thread-list__kebab') as HTMLElement).click();
      fixture.detectChanges();
      const labels = Array.from(document.querySelectorAll('.chat-overflow-menu__item'))
        .map((el) => (el as HTMLElement).textContent?.trim());
      expect(labels).not.toContain('Pin');
      expect(labels).not.toContain('Unpin');
    });

    it('Unpin: action provided + row pinned → menu includes "Unpin"', () => {
      const fixture = render({
        threads: [{ id: 't1', title: 'First', pinned: true }, { id: 't2', title: 'Second' }],
        actions: { unpin: noop },
      });
      (fixture.nativeElement.querySelector('.chat-thread-list__kebab') as HTMLElement).click();
      fixture.detectChanges();
      const labels = Array.from(document.querySelectorAll('.chat-overflow-menu__item'))
        .map((el) => (el as HTMLElement).textContent?.trim());
      expect(labels).toContain('Unpin');
      expect(labels).not.toContain('Pin');
    });

    it('Pin+Unpin both provided, row not pinned → menu has "Pin" not "Unpin"', () => {
      const fixture = render({ actions: { pin: noop, unpin: noop } });
      (fixture.nativeElement.querySelector('.chat-thread-list__kebab') as HTMLElement).click();
      fixture.detectChanges();
      const labels = Array.from(document.querySelectorAll('.chat-overflow-menu__item'))
        .map((el) => (el as HTMLElement).textContent?.trim());
      expect(labels).toContain('Pin');
      expect(labels).not.toContain('Unpin');
    });

    it('Pin+Unpin both provided, row pinned → menu has "Unpin" not "Pin"', () => {
      const fixture = render({
        threads: [{ id: 't1', title: 'First', pinned: true }, { id: 't2', title: 'Second' }],
        actions: { pin: noop, unpin: noop },
      });
      (fixture.nativeElement.querySelector('.chat-thread-list__kebab') as HTMLElement).click();
      fixture.detectChanges();
      const labels = Array.from(document.querySelectorAll('.chat-overflow-menu__item'))
        .map((el) => (el as HTMLElement).textContent?.trim());
      expect(labels).toContain('Unpin');
      expect(labels).not.toContain('Pin');
    });

    it('Pin icon SVG renders only when thread.pinned === true', () => {
      const fixture = render({
        threads: [{ id: 't1', title: 'First', pinned: true }, { id: 't2', title: 'Second' }],
        actions: { pin: noop, unpin: noop },
      });
      const pins = fixture.nativeElement.querySelectorAll('.chat-thread-list__item-pin');
      expect(pins.length).toBe(1);
      const titles = fixture.nativeElement.querySelectorAll('.chat-thread-list__item-title');
      expect(titles[0].querySelector('.chat-thread-list__item-pin')).not.toBeNull();
      expect(titles[1].querySelector('.chat-thread-list__item-pin')).toBeNull();
    });

    it('mode="archived" with only rename+archive (no unarchive/delete) hides the kebab', () => {
      const fixture = TestBed.createComponent(ChatThreadListComponent);
      fixture.componentRef.setInput('threads', [{ id: 't1', title: 'A', status: 'archived' as const }]);
      fixture.componentRef.setInput('actions', { rename: vi.fn().mockResolvedValue(undefined), archive: vi.fn().mockResolvedValue(undefined) });
      fixture.componentRef.setInput('mode', 'archived');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.chat-thread-list__kebab')).toBeNull();
    });
  });
});
