// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { ChatSidebarComponent, a2uiBasicCatalog } from '@threadplane/chat';
import { AgUiShell } from '../shell/ag-ui-shell.component';
import { WelcomeSuggestionsComponent } from './welcome-suggestions.component';

@Component({
  selector: 'sidebar-mode',
  standalone: true,
  imports: [ChatSidebarComponent, WelcomeSuggestionsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <chat-sidebar
      [agent]="agent"
      [clientTools]="shell.clientTools"
      [views]="catalog"
      [modelOptions]="shell.modelOptions()"
      [selectedModel]="shell.model()"
      [showModelPicker]="false"
      [open]="true"
      [pushContent]="true"
      (selectedModelChange)="shell.onModelChange($event)"
    >
      <div class="sidebar-mode__background">
        <!-- In App mode the map is the background; this placeholder hint would
             float unreadably over it, so only show it in plain sidebar mode. -->
        @if (shell.appMode() !== 'on') {
          <p class="sidebar-mode__hint">
            Use the launcher (right edge) to dismiss or re-open the chat panel.
          </p>
        }
      </div>
      <welcome-suggestions chatWelcomeSuggestions (selected)="send($event)" />
    </chat-sidebar>
  `,
  styles: [`
    :host { display: block; flex: 1; min-height: 0; position: relative; }
    /* Projected into chat-sidebar's default content slot so [pushContent]
     * applies its right-margin push to this background when the panel
     * opens. Sized to fill the visible area below the toolbar. */
    .sidebar-mode__background {
      display: grid;
      place-items: center;
      height: 100%;
      color: #8a92a3;
      font-size: 14px;
    }
  `],
})
export class SidebarMode {
  protected readonly agent = inject(AgUiShell).agent;
  protected readonly shell = inject(AgUiShell);
  // Phase 4: A2UI component catalog forwarded to <chat-sidebar>.
  protected readonly catalog = a2uiBasicCatalog();

  protected send(text: string): void {
    void this.agent.submit({ message: text });
  }
}
