// libs/chat/src/lib/primitives/chat-message/chat-message.component.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ChatMessageComponent } from './chat-message.component';

describe('ChatMessageComponent', () => {
  it('instantiates without error', () => {
    TestBed.configureTestingModule({});
    let component!: ChatMessageComponent;
    TestBed.runInInjectionContext(() => {
      component = new ChatMessageComponent();
    });
    expect(component).toBeTruthy();
  });
});
