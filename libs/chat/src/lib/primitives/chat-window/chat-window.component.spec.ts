// libs/chat/src/lib/primitives/chat-window/chat-window.component.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ChatWindowComponent } from './chat-window.component';

@Component({
  standalone: true,
  imports: [ChatWindowComponent],
  template: `
    <chat-window>
      <span chatHeader>My Chat</span>
      <div chatBody>messages here</div>
      <div chatFooter>input here</div>
    </chat-window>
  `,
})
class Host {}

describe('ChatWindowComponent', () => {
  it('projects header / body / footer slots', () => {
    TestBed.configureTestingModule({});
    const fx = TestBed.createComponent(Host);
    fx.detectChanges();
    const win = fx.nativeElement.querySelector('chat-window') as HTMLElement;
    expect(win.querySelector('.chat-window__header')!.textContent).toContain('My Chat');
    expect(win.querySelector('.chat-window__body')!.textContent).toContain('messages here');
    expect(win.querySelector('.chat-window__footer')!.textContent).toContain('input here');
  });
});
