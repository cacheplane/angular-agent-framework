// SPDX-License-Identifier: MIT
import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import {
  ChatWelcomeSuggestionComponent,
  ChatSelectComponent,
  type ChatSelectOption,
} from '@threadplane/chat';
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
        width: 100%;
        padding: 0 12px;
        box-sizing: border-box;
      }
      .welcome-suggestions__row {
        display: flex;
        align-items: center;
        gap: 12px;
        max-width: 100%;
      }
      .welcome-suggestions__featured {
        flex: 1 1 0;
        min-width: 0;
        max-width: 380px;
        overflow: hidden;
      }
      /* chat-welcome-suggestion host is display: inline-block by default
       * (sizes to content). At narrow viewports this lets the inner
       * button overflow the wrapper and get clipped at the wrapper's
       * right edge ("hard right border"). Force block sizing here so
       * the host follows the wrapper's flex-shrunk width and the
       * label inside ellipsizes. */
      .welcome-suggestions__featured ::ng-deep chat-welcome-suggestion {
        display: block;
        width: 100%;
      }
      .welcome-suggestions__featured ::ng-deep .chat-welcome-suggestion {
        width: 100%;
      }
      .welcome-suggestions__featured ::ng-deep .chat-welcome-suggestion__label {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        min-width: 0;
        flex: 1 1 auto;
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
      .welcome-suggestions__row ::ng-deep chat-select .chat-select__menu {
        min-width: 320px;
        max-width: 480px;
        width: max-content;
      }
      .welcome-suggestions__row > chat-select {
        flex: 0 0 auto;
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
