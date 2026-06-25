// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { ChatSidebarComponent, a2uiBasicCatalog } from '@threadplane/chat';
import { AgUiShell } from '../shell/ag-ui-shell.component';
import { AppModePromoComponent } from './app-mode-promo.component';
import { WelcomeSuggestionsComponent } from './welcome-suggestions.component';

@Component({
  selector: 'sidebar-mode',
  standalone: true,
  imports: [ChatSidebarComponent, AppModePromoComponent, WelcomeSuggestionsComponent],
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
        <!-- Plain sidebar mode (App mode off): market the App-mode cockpit and
             the Threadplane primitives, with a CTA to turn it on. -->
        @if (shell.appMode() !== 'on') {
          <app-mode-promo
            [hasMapsKey]="shell.hasMapsKey"
            (enable)="shell.onAppModeChange('on')"
          />
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
      min-height: calc(100dvh - var(--demo-toolbar-height, 51px));
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
  protected readonly agent = inject(AgUiShell).agent;
  protected readonly shell = inject(AgUiShell);
  // Phase 4: A2UI component catalog forwarded to <chat-sidebar>.
  protected readonly catalog = a2uiBasicCatalog();

  protected send(text: string): void {
    void this.agent.submit({ message: text });
  }
}
