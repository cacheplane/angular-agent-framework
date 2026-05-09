// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { ChatComponent, ChatWelcomeSuggestionComponent, a2uiBasicCatalog } from '@ngaf/chat';
import { DEMO_AGENT } from '../shell/shell-tokens';
import { WELCOME_SUGGESTIONS } from './welcome-suggestions';

@Component({
  selector: 'embed-mode',
  standalone: true,
  imports: [ChatComponent, ChatWelcomeSuggestionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <chat [agent]="agent" [views]="catalog">
      <div chatWelcomeSuggestions>
        @for (s of suggestions; track s.value) {
          <chat-welcome-suggestion
            [label]="s.label"
            [value]="s.value"
            (selected)="send($event)"
          />
        }
      </div>
    </chat>
  `,
  styles: [`
    :host { display: block; height: 100%; }
  `],
})
export class EmbedMode {
  protected readonly agent = inject(DEMO_AGENT);
  protected readonly suggestions = WELCOME_SUGGESTIONS;
  // Phase 4: catalog of A2UI components the chat composition uses to
  // render <a2ui-surface> when an AI message content begins with the
  // ---a2ui_JSON--- wire-format prefix. Without this, the surface is
  // parsed correctly but never mounted (the @if gate requires views()).
  protected readonly catalog = a2uiBasicCatalog();

  protected send(text: string): void {
    void this.agent.submit({ message: text });
  }
}
