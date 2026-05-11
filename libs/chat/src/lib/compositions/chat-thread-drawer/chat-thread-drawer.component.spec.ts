// libs/chat/src/lib/compositions/chat-thread-drawer/chat-thread-drawer.component.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ChatThreadDrawerComponent } from './chat-thread-drawer.component';

@Component({
  standalone: true,
  imports: [ChatThreadDrawerComponent],
  template: `<chat-thread-drawer
    [open]="open"
    [mode]="mode"
    (openChange)="onOpenChange($event)">
    <div data-testid="drawer-body">child content</div>
  </chat-thread-drawer>`,
})
class HostComponent {
  open = false;
  mode: 'push' | 'overlay' = 'push';
  changes: boolean[] = [];
  onOpenChange(v: boolean): void { this.changes.push(v); }
}

describe('ChatThreadDrawerComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [HostComponent] }));

  it('hides the drawer when open=false (translated off-screen)', () => {
    const fx = TestBed.createComponent(HostComponent);
    fx.detectChanges();
    const drawer = fx.nativeElement.querySelector('.chat-thread-drawer') as HTMLElement;
    expect(drawer.getAttribute('data-open')).toBe('false');
  });

  it('shows the drawer when open=true', () => {
    const fx = TestBed.createComponent(HostComponent);
    fx.componentInstance.open = true;
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('.chat-thread-drawer').getAttribute('data-open')).toBe('true');
  });

  it('renders no scrim in push mode', () => {
    const fx = TestBed.createComponent(HostComponent);
    fx.componentInstance.open = true;
    fx.componentInstance.mode = 'push';
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('.chat-thread-drawer__scrim')).toBeNull();
  });

  it('renders a scrim in overlay mode when open', () => {
    const fx = TestBed.createComponent(HostComponent);
    fx.componentInstance.open = true;
    fx.componentInstance.mode = 'overlay';
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('.chat-thread-drawer__scrim')).toBeTruthy();
  });

  it('scrim click emits openChange(false)', () => {
    const fx = TestBed.createComponent(HostComponent);
    fx.componentInstance.open = true;
    fx.componentInstance.mode = 'overlay';
    fx.detectChanges();
    (fx.nativeElement.querySelector('.chat-thread-drawer__scrim') as HTMLElement).click();
    expect(fx.componentInstance.changes).toEqual([false]);
  });

  it('Escape keydown on drawer host emits openChange(false)', () => {
    const fx = TestBed.createComponent(HostComponent);
    fx.componentInstance.open = true;
    fx.detectChanges();
    const drawer = fx.nativeElement.querySelector('.chat-thread-drawer') as HTMLElement;
    drawer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(fx.componentInstance.changes).toEqual([false]);
  });

  it('projects child content into the drawer body', () => {
    const fx = TestBed.createComponent(HostComponent);
    fx.componentInstance.open = true;
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('[data-testid="drawer-body"]')).toBeTruthy();
  });
});
