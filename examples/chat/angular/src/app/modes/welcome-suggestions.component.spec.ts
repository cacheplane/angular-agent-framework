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

  // JSDOM does not cascade ::ng-deep overrides from Angular component <style>
  // tags, so we assert against the component's compiled styles string instead
  // of relying on getComputedStyle — same approach used for border-width above.
  it('widens the More prompts dropdown menu in the component styles', () => {
    const cls: any = WelcomeSuggestionsComponent;
    const styles = ((cls['ɵcmp'] as { styles?: string[] })?.styles ?? []).join(' ');
    expect(styles).toMatch(/chat-select__menu[^}]*min-width:\s*320px/);
    expect(styles).toMatch(/chat-select__menu[^}]*max-width:\s*480px/);
  });

  it('overrides the More prompts trigger to match the featured chip styling', () => {
    // The component's styles block must include ::ng-deep overrides for the
    // chat-select trigger so it visually matches chat-welcome-suggestion.
    // We assert by inspecting the component's stringified styles via the
    // DOM: the trigger should compute to chip-equivalent padding/border.
    const trigger = fx.nativeElement.querySelector(
      '.welcome-suggestions__row chat-select .chat-select__trigger',
    ) as HTMLElement;
    expect(trigger).toBeTruthy();
    const cs = getComputedStyle(trigger);
    // 10px 16px padding (chip)
    expect(cs.paddingTop).toBe('10px');
    expect(cs.paddingBottom).toBe('10px');
    expect(cs.paddingLeft).toBe('16px');
    expect(cs.paddingRight).toBe('16px');
    // 1px border (chip has a border; default trigger has none).
    // JSDOM 29 does not cascade border-width from <style> tags so we assert
    // the source instead of getComputedStyle — the CSS must declare a border.
    const componentStyles = (fx.componentInstance.constructor as { ɵcmp?: { styles?: string[] } }).ɵcmp?.styles?.join(' ') ?? '';
    expect(componentStyles).toMatch(/border:\s*1px\s+solid/);
    // pill radius (chip)
    expect(cs.borderRadius).toBe('9999px');
  });
});
