// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { ChatPopupComponent, a2uiBasicCatalog } from '@threadplane/chat';
import { DemoShell } from '../shell/demo-shell.component';
import { DEMO_AGENT } from '../shell/shell-tokens';
import { WelcomeSuggestionsComponent } from './welcome-suggestions.component';

@Component({
  selector: 'popup-mode',
  standalone: true,
  imports: [ChatPopupComponent, WelcomeSuggestionsComponent],
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
      [modelOptions]="shell.modelOptions()"
      [selectedModel]="shell.model()"
      [showModelPicker]="false"
      (selectedModelChange)="shell.onModelChange($event)"
    >
      <welcome-suggestions chatWelcomeSuggestions (selected)="send($event)" />
    </chat-popup>
  `,
  styles: [`
    :host { display: block; flex: 1; min-height: 0; }
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
  // Phase 4: A2UI component catalog forwarded to <chat-popup>.
  protected readonly catalog = a2uiBasicCatalog();

  protected send(text: string): void {
    void this.agent.submit({ message: text });
  }
}
