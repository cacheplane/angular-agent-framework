// libs/chat/src/lib/compositions/chat-popup/chat-popup.component.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ChatPopupComponent } from './chat-popup.component';

describe('ChatPopupComponent', () => {
  it('class is defined and imports resolve', () => {
    expect(ChatPopupComponent).toBeDefined();
    expect(typeof ChatPopupComponent).toBe('function');
  });

  it('toggle/openWindow/closeWindow flip the open model', () => {
    TestBed.configureTestingModule({});
    TestBed.runInInjectionContext(() => {
      const popup = new ChatPopupComponent();
      expect(popup.open()).toBe(false);
      popup.toggle();
      expect(popup.open()).toBe(true);
      popup.toggle();
      expect(popup.open()).toBe(false);
      popup.openWindow();
      expect(popup.open()).toBe(true);
      popup.closeWindow();
      expect(popup.open()).toBe(false);
    });
  });
});
