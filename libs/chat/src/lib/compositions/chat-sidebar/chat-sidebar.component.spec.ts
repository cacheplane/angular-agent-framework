// libs/chat/src/lib/compositions/chat-sidebar/chat-sidebar.component.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
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
