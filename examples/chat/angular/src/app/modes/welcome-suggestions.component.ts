// SPDX-License-Identifier: MIT
import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import {
  ChatWelcomeSuggestionComponent,
  ChatSelectComponent,
  type ChatSelectOption,
} from '@ngaf/chat';
import { FEATURED_SUGGESTIONS, MORE_SUGGESTIONS } from './welcome-suggestions';

/**
 * Demo-side composition that renders the welcome-state suggestion surface
 * as a single featured chip + a "More prompts" dropdown for everything
 * else. The featured chip is `FEATURED_SUGGESTIONS[0]` — consumer
 * controls which prompt is featured by ordering the array.
 *
 * Output `(selected)` fires with the suggestion's `value` for BOTH chip
 * clicks and dropdown picks — consumers wire it directly to
 * `agent.submit({ message: $event })` for auto-send semantics.
 */
@Component({
  selector: 'welcome-suggestions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChatWelcomeSuggestionComponent, ChatSelectComponent],
  template: `
    <div class="welcome-suggestions__row">
      <chat-welcome-suggestion
        class="welcome-suggestions__featured"
        [label]="featuredOne.label"
        [value]="featuredOne.value"
        (selected)="selected.emit($event)"
      />
      <chat-select
        [options]="moreOptions"
        placeholder="More prompts"
        menuLabel="More demo prompts"
        (valueChange)="selected.emit($event)"
      />
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        justify-content: center;
      }
      .welcome-suggestions__row {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .welcome-suggestions__featured {
        max-width: 380px;
        overflow: hidden;
      }
      .welcome-suggestions__featured ::ng-deep .chat-welcome-suggestion__label {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      /* Make the "More prompts" dropdown match the featured chip visually.
         Scoped to .welcome-suggestions__row so the model picker (also
         chat-select, elsewhere) is untouched. */
      .welcome-suggestions__row ::ng-deep chat-select .chat-select__trigger {
        height: auto;
        padding: 10px 16px;
        background: var(--ngaf-chat-surface);
        color: var(--ngaf-chat-text);
        border: 1px solid var(--ngaf-chat-separator);
        border-radius: 9999px;
        font-size: var(--ngaf-chat-font-size-sm);
      }
      .welcome-suggestions__row ::ng-deep chat-select .chat-select__trigger:hover:not(:disabled) {
        background: var(--ngaf-chat-surface-alt);
        border-color: var(--ngaf-chat-text-muted);
        color: var(--ngaf-chat-text);
      }
    `,
  ],
})
export class WelcomeSuggestionsComponent {
  readonly selected = output<string>();
  protected readonly featuredOne = FEATURED_SUGGESTIONS[0];
  protected readonly moreOptions: readonly ChatSelectOption[] = [
    ...FEATURED_SUGGESTIONS.slice(1),
    ...MORE_SUGGESTIONS,
  ].map((s) => ({ value: s.value, label: s.label }));
}
