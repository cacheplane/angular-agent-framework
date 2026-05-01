// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ChatLauncherButtonComponent } from './chat-launcher-button.component';

describe('ChatLauncherButtonComponent', () => {
  it('renders a button', () => {
    TestBed.configureTestingModule({});
    const fx = TestBed.createComponent(ChatLauncherButtonComponent);
    fx.detectChanges();
    const btn = (fx.nativeElement as HTMLElement).querySelector('.chat-launcher-button');
    expect(btn).toBeTruthy();
    expect(btn!.tagName).toBe('BUTTON');
    expect(btn!.getAttribute('aria-label')).toBe('Open chat');
  });

  it('contains an svg icon', () => {
    TestBed.configureTestingModule({});
    const fx = TestBed.createComponent(ChatLauncherButtonComponent);
    fx.detectChanges();
    const svg = (fx.nativeElement as HTMLElement).querySelector('.chat-launcher-button svg');
    expect(svg).toBeTruthy();
  });
});
