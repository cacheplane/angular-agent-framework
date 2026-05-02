// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatWelcomeComponent } from './chat-welcome.component';

describe('ChatWelcomeComponent', () => {
  let fixture: ComponentFixture<ChatWelcomeComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    fixture = TestBed.createComponent(ChatWelcomeComponent);
    fixture.detectChanges();
  });

  it('renders default greeting', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.chat-welcome__title')?.textContent).toContain('How can I help?');
    expect(el.querySelector('.chat-welcome__subtitle')?.textContent).toContain('Ask anything');
  });

  it('renders the beacon dot', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.chat-welcome__beacon')).not.toBeNull();
  });

  it('exposes slots for title, subtitle, input, suggestions', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.chat-welcome__inner')).not.toBeNull();
    expect(el.querySelector('.chat-welcome__input')).not.toBeNull();
    expect(el.querySelector('.chat-welcome__suggestions')).not.toBeNull();
  });
});
