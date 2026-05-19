// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { ChatSidebarComponent, a2uiBasicCatalog } from '@ngaf/chat';
import { DemoShell } from '../shell/demo-shell.component';
import { DEMO_AGENT } from '../shell/shell-tokens';
import { WelcomeSuggestionsComponent } from './welcome-suggestions.component';

@Component({
  selector: 'sidebar-mode',
  standalone: true,
  imports: [ChatSidebarComponent, WelcomeSuggestionsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sidebar-mode__background">
      <p class="sidebar-mode__hint">
        Use the launcher (right edge) to dismiss or re-open the chat panel.
      </p>
    </div>
    <chat-sidebar
      [agent]="agent"
      [views]="catalog"
      [modelOptions]="shell.modelOptions()"
      [selectedModel]="shell.model()"
      [open]="true"
      (selectedModelChange)="shell.onModelChange($event)"
      (replayRequested)="shell.onTimelineReplay($event)"
      (forkRequested)="shell.onTimelineFork($event)"
    >
      <welcome-suggestions chatWelcomeSuggestions (selected)="send($event)" />
    </chat-sidebar>
  `,
  styles: [`
    /* chat-sidebar's visible chrome is position: fixed (panel + launcher),
     * so its host element doesn't need to take layout space. Use
     * display: contents on the host to drop it from the flow, and let
     * the sibling .sidebar-mode__background fill the visible area. */
    :host { display: block; flex: 1; min-height: 0; position: relative; }
    .sidebar-mode__background {
      display: grid;
      place-items: center;
      height: 100%;
      color: #8a92a3;
      font-size: 14px;
    }
    :host ::ng-deep > chat-sidebar { display: contents; }
    /* The chat-sidebar default content slot (.chat-sidebar__content) is
     * meant for the consumer's page content when chat-sidebar is in
     * push mode. The demo uses .sidebar-mode__background instead, so
     * hide the default content slot — its min-height: 100vh would
     * otherwise stack below the background and overflow the page. */
    :host ::ng-deep .chat-sidebar__content { display: none; }
  `],
})
export class SidebarMode {
  protected readonly agent = inject(DEMO_AGENT);
  protected readonly shell = inject(DemoShell);
  // Phase 4: A2UI component catalog forwarded to <chat-sidebar>.
  protected readonly catalog = a2uiBasicCatalog();

  protected send(text: string): void {
    void this.agent.submit({ message: text });
  }
}
