// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatSidenavScrimComponent } from './chat-sidenav-scrim.component';

describe('ChatSidenavScrimComponent', () => {
  let fx: ComponentFixture<ChatSidenavScrimComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ChatSidenavScrimComponent] });
    fx = TestBed.createComponent(ChatSidenavScrimComponent);
  });

  it('renders nothing when [open] is false (default)', () => {
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('button')).toBeNull();
  });

  it('renders the scrim button when [open] is true', () => {
    fx.componentRef.setInput('open', true);
    fx.detectChanges();
    const btn = fx.nativeElement.querySelector('button.chat-sidenav-scrim__button') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('aria-label')).toBe('Close conversations');
  });

  it('emits (close) on click', () => {
    fx.componentRef.setInput('open', true);
    fx.detectChanges();
    let closed = false;
    fx.componentInstance.close.subscribe(() => { closed = true; });
    const btn = fx.nativeElement.querySelector('button.chat-sidenav-scrim__button') as HTMLButtonElement;
    btn.click();
    expect(closed).toBe(true);
  });
});
