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
 * as 3 curated chips above + a "More prompts" dropdown below for the
 * remaining demo prompts. Reuses `<chat-welcome-suggestion>` (chip) and
 * `<chat-select>` (the same primitive backing the model picker pill).
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
    <div class="welcome-suggestions__featured">
      @for (s of featured; track s.value) {
        <chat-welcome-suggestion
          [label]="s.label"
          [value]="s.value"
          (selected)="selected.emit($event)"
        />
      }
    </div>
    <div class="welcome-suggestions__overflow">
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
        flex-direction: column;
        align-items: center;
        gap: 12px;
      }
      .welcome-suggestions__featured {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
      }
    `,
  ],
})
export class WelcomeSuggestionsComponent {
  readonly selected = output<string>();
  protected readonly featured = FEATURED_SUGGESTIONS;
  protected readonly moreOptions: readonly ChatSelectOption[] = MORE_SUGGESTIONS.map(
    (s) => ({ value: s.value, label: s.label }),
  );
}
