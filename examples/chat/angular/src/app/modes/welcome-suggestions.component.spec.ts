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

  it('renders one chip per FEATURED_SUGGESTIONS entry', () => {
    const chips = fx.nativeElement.querySelectorAll('chat-welcome-suggestion');
    expect(chips.length).toBe(FEATURED_SUGGESTIONS.length);
    expect(FEATURED_SUGGESTIONS.length).toBe(3);
  });

  it('renders the chip labels in order', () => {
    const labels = Array.from(
      fx.nativeElement.querySelectorAll('chat-welcome-suggestion .chat-welcome-suggestion__label'),
    ).map((el) => (el as HTMLElement).textContent?.trim());
    expect(labels).toEqual(FEATURED_SUGGESTIONS.map((s) => s.label));
  });

  it('renders the overflow chat-select with "More prompts" placeholder', () => {
    const select = fx.nativeElement.querySelector('chat-select');
    expect(select).toBeTruthy();
    const trigger = select.querySelector('.chat-select__trigger') as HTMLElement;
    expect(trigger.textContent).toContain('More prompts');
  });

  it('passes MORE_SUGGESTIONS through as chat-select options', () => {
    const opts = fx.componentInstance['moreOptions'] as { value: string; label: string }[];
    expect(opts.length).toBe(MORE_SUGGESTIONS.length);
    expect(opts.length).toBe(14);
    expect(opts[0].label).toBe(MORE_SUGGESTIONS[0].label);
    expect(opts[0].value).toBe(MORE_SUGGESTIONS[0].value);
  });

  it('emits (selected) when a chip is clicked', () => {
    let captured: string | null = null;
    fx.componentInstance.selected.subscribe((v) => (captured = v));
    const firstChipBtn = fx.nativeElement.querySelector('chat-welcome-suggestion button') as HTMLButtonElement;
    firstChipBtn.click();
    expect(captured).toBe(FEATURED_SUGGESTIONS[0].value);
  });
});
