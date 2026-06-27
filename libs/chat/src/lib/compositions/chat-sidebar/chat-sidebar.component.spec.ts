// libs/chat/src/lib/compositions/chat-sidebar/chat-sidebar.component.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { EnvironmentInjector, createEnvironmentInjector, runInInjectionContext } from '@angular/core';
import { ChatSidebarComponent } from './chat-sidebar.component';

describe('ChatSidebarComponent', () => {
  it('class is defined and imports resolve', () => {
    expect(ChatSidebarComponent).toBeDefined();
    expect(typeof ChatSidebarComponent).toBe('function');
  });

  it('toggle/openWindow/closeWindow flip the open model', () => {
    TestBed.configureTestingModule({});
    TestBed.runInInjectionContext(() => {
      const sidebar = new ChatSidebarComponent();
      expect(sidebar.open()).toBe(false);
      sidebar.toggle();
      expect(sidebar.open()).toBe(true);
      sidebar.toggle();
      expect(sidebar.open()).toBe(false);
      sidebar.openWindow();
      expect(sidebar.open()).toBe(true);
      sidebar.closeWindow();
      expect(sidebar.open()).toBe(false);
    });
  });
});

describe('ChatSidebarComponent — edge-claim attribute', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-threadplane-chat-sidebar');
  });

  it('sets data-threadplane-chat-sidebar="open" on <html> while open', () => {
    TestBed.configureTestingModule({});
    TestBed.runInInjectionContext(() => {
      const sidebar = new ChatSidebarComponent();
      // Trigger the open-tracking effect by setting open=true
      sidebar.openWindow();
      // Force a microtask flush so the effect runs
      TestBed.flushEffects();
      expect(document.documentElement.getAttribute('data-threadplane-chat-sidebar')).toBe('open');
    });
  });

  it('removes data-threadplane-chat-sidebar from <html> when closed', () => {
    TestBed.configureTestingModule({});
    TestBed.runInInjectionContext(() => {
      const sidebar = new ChatSidebarComponent();
      sidebar.openWindow();
      TestBed.flushEffects();
      sidebar.closeWindow();
      TestBed.flushEffects();
      expect(document.documentElement.hasAttribute('data-threadplane-chat-sidebar')).toBe(false);
    });
  });

  it('removes the <html> claim when the sidebar is DESTROYED while open', () => {
    // Regression: unmounting an open sidebar (e.g. switching demo modes) must
    // not leave data-threadplane-chat-sidebar="open" stuck on <html>, or peer
    // panels keep reserving --ngaf-chat-occupy-right and a phantom gap persists.
    TestBed.configureTestingModule({});
    const parent = TestBed.inject(EnvironmentInjector);
    const child = createEnvironmentInjector([], parent);
    let sidebar!: ChatSidebarComponent;
    runInInjectionContext(child, () => {
      sidebar = new ChatSidebarComponent();
    });
    sidebar.openWindow();
    TestBed.flushEffects();
    expect(document.documentElement.getAttribute('data-threadplane-chat-sidebar')).toBe('open');
    // Destroy the injector that owns the component's effects (simulates unmount).
    child.destroy();
    expect(document.documentElement.hasAttribute('data-threadplane-chat-sidebar')).toBe(false);
  });

  it('flex layout: host is a flex row with threaded height (no hardcoded 100vh content)', () => {
    // Angular rewrites :host → [_nghost-%COMP%] and appends [_ngcontent-%COMP%]
    // to class selectors, so match those forms (see the panel/launcher tests).
    const styles = (ChatSidebarComponent as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles.join('\n');
    // Host is a flex row (the only host block carrying display:flex).
    expect(styles).toMatch(/\[_nghost-%COMP%\][^{]*\{[^}]*display:\s*flex/);
    // The content slot fills via flex (not a hardcoded viewport height).
    expect(styles).toMatch(/\.chat-sidebar__content[^{]*\{[^}]*flex:\s*1\s+1\s+auto/);
    expect(styles).not.toMatch(/min-height:\s*100vh/);
  });

  it('panel CSS reads PEER --ngaf-chat-debug-claim-bottom (not aggregate)', () => {
    // Components must read PEER per-component claim vars, never the
    // aggregate occupy-* (which they write to themselves). The aggregate
    // is for external consumer convenience; internal panels read
    // peer-specific to avoid self-feedback.
    const styles = (ChatSidebarComponent as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles.join('\n');
    expect(styles).toMatch(/\.chat-sidebar__panel[^{]*\{[^}]*bottom:\s*var\(--ngaf-chat-debug-claim-bottom/);
  });

  it('launcher CSS reads PEER --ngaf-chat-debug-claim-bottom (not aggregate)', () => {
    const styles = (ChatSidebarComponent as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles.join('\n');
    expect(styles).toMatch(/\.chat-sidebar__launcher[^{]*\{[^}]*bottom:\s*calc\(1rem\s*\+\s*var\(--ngaf-chat-debug-claim-bottom/);
  });
});
