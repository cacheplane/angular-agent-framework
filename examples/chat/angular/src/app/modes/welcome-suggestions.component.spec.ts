// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WelcomeSuggestionsComponent } from './welcome-suggestions.component';
import { FEATURED_SUGGESTIONS, MORE_SUGGESTIONS } from './welcome-suggestions';

describe('WelcomeSuggestionsComponent', () => {
  let fx: ComponentFixture<WelcomeSuggestionsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [WelcomeSuggestionsComponent] });
    fx = TestBed.createComponent(WelcomeSuggestionsComponent);
    fx.detectChanges();
  });

  it('renders exactly one featured chip', () => {
    const chips = fx.nativeElement.querySelectorAll('chat-welcome-suggestion');
    expect(chips.length).toBe(1);
  });

  it('renders the first featured suggestion as the chip', () => {
    const label = fx.nativeElement.querySelector(
      'chat-welcome-suggestion .chat-welcome-suggestion__label',
    ) as HTMLElement;
    expect(label.textContent?.trim()).toBe(FEATURED_SUGGESTIONS[0].label);
  });

  it('renders the overflow chat-select with "More prompts" placeholder', () => {
    const select = fx.nativeElement.querySelector('chat-select');
    expect(select).toBeTruthy();
    const trigger = select.querySelector('.chat-select__trigger') as HTMLElement;
    expect(trigger.textContent).toContain('More prompts');
  });

  it('merges FEATURED_SUGGESTIONS[1..] + MORE_SUGGESTIONS into dropdown options', () => {
    const opts = fx.componentInstance['moreOptions'] as { value: string; label: string }[];
    const expectedLen = FEATURED_SUGGESTIONS.length - 1 + MORE_SUGGESTIONS.length;
    expect(opts.length).toBe(expectedLen);
    expect(opts[0].label).toBe(FEATURED_SUGGESTIONS[1].label);
    expect(opts[0].value).toBe(FEATURED_SUGGESTIONS[1].value);
    const moreStart = FEATURED_SUGGESTIONS.length - 1;
    expect(opts[moreStart].label).toBe(MORE_SUGGESTIONS[0].label);
  });

  it('emits (selected) with the featured value when the chip is clicked', () => {
    let captured: string | null = null;
    fx.componentInstance.selected.subscribe((v) => (captured = v));
    const chipBtn = fx.nativeElement.querySelector(
      'chat-welcome-suggestion button',
    ) as HTMLButtonElement;
    chipBtn.click();
    expect(captured).toBe(FEATURED_SUGGESTIONS[0].value);
  });
});
