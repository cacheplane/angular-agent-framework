// libs/example-layouts/src/lib/example-chat-layout.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input } from '@angular/core';

@Component({
  selector: 'example-chat-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      height: 100dvh;
      background: var(--ngaf-chat-bg, #fff);
      color: var(--ngaf-chat-text, #1a1a1a);
      font-family: var(--ngaf-chat-font-family, system-ui, sans-serif);
    }
    .layout {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }
    .layout__main { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
    .layout__sidebar {
      width: 100%;
      flex-shrink: 0;
      border-top: 1px solid var(--ngaf-chat-separator, #e5e5e5);
      overflow-y: auto;
    }
    .layout__sidebar:empty { display: none; }
    @media (min-width: 768px) {
      .layout { flex-direction: row; }
      .layout--sidebar-left { flex-direction: row-reverse; }
      .layout__sidebar {
        width: var(--example-layout-sidebar-width, 18rem);
        border-top: 0;
        border-left: 1px solid var(--ngaf-chat-separator, #e5e5e5);
      }
      .layout--sidebar-left .layout__sidebar {
        border-left: 0;
        border-right: 1px solid var(--ngaf-chat-separator, #e5e5e5);
      }
    }
  `,
  template: `
    <div [class]="'layout layout--sidebar-' + sidebarPosition()" [style.--example-layout-sidebar-width]="sidebarWidth()">
      <div class="layout__main"><ng-content select="[main]" /></div>
      <aside class="layout__sidebar"><ng-content select="[sidebar]" /></aside>
    </div>
  `,
})
export class ExampleChatLayoutComponent {
  readonly sidebarPosition = input<'left' | 'right'>('right');
  readonly sidebarWidth = input('18rem');
}
