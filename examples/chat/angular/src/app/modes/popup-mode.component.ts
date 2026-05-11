// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { ChatPopupComponent, ChatWelcomeSuggestionComponent, a2uiBasicCatalog } from '@ngaf/chat';
import { DemoShell } from '../shell/demo-shell.component';
import { DEMO_AGENT } from '../shell/shell-tokens';
import { WELCOME_SUGGESTIONS } from './welcome-suggestions';

@Component({
  selector: 'popup-mode',
  standalone: true,
  imports: [ChatPopupComponent, ChatWelcomeSuggestionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="popup-mode__background">
      <p class="popup-mode__hint">
        Click the launcher button (bottom-right) to open the chat.
      </p>
    </div>
    <chat-popup
      [agent]="agent"
      [views]="catalog"
      (replayRequested)="shell.onTimelineReplay($event)"
      (forkRequested)="shell.onTimelineFork($event)"
    >
      <div chatWelcomeSuggestions>
        @for (s of suggestions; track s.value) {
          <chat-welcome-suggestion
            [label]="s.label"
            [value]="s.value"
            (selected)="send($event)"
          />
        }
      </div>
    </chat-popup>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .popup-mode__background {
      display: grid;
      place-items: center;
      height: 100%;
      color: #8a92a3;
      font-size: 14px;
    }
  `],
})
export class PopupMode {
  protected readonly agent = inject(DEMO_AGENT);
  protected readonly shell = inject(DemoShell);
  protected readonly suggestions = WELCOME_SUGGESTIONS;
  // Phase 4: A2UI component catalog forwarded to <chat-popup>.
  protected readonly catalog = a2uiBasicCatalog();

  protected send(text: string): void {
    void this.agent.submit({ message: text });
  }
}
