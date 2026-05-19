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
    <chat-sidebar
      [agent]="agent"
      [views]="catalog"
      [modelOptions]="shell.modelOptions()"
      [selectedModel]="shell.model()"
      [open]="true"
      [pushContent]="true"
      (selectedModelChange)="shell.onModelChange($event)"
      (replayRequested)="shell.onTimelineReplay($event)"
      (forkRequested)="shell.onTimelineFork($event)"
    >
      <div class="sidebar-mode__background">
        <p class="sidebar-mode__hint">
          Use the launcher (right edge) to dismiss or re-open the chat panel.
        </p>
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
      min-height: calc(100dvh - var(--demo-toolbar-height, 51px));
      color: #8a92a3;
      font-size: 14px;
    }
    /* chat-sidebar's default content slot sets min-height: 100vh which,
     * combined with the demo's flex column, would otherwise overflow the
     * page. The background div above provides the visible "page" so we
     * cap the chat-sidebar__content height to the available space. */
    :host ::ng-deep .chat-sidebar__content {
      /* Important: lib sets min-height: 100vh on this slot which would
       * push the page 51px below the viewport in our flex column under
       * the 51px toolbar. Override here. */
      min-height: 0 !important;
    }
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
