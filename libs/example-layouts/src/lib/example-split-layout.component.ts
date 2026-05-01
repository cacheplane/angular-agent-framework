// libs/example-layouts/src/lib/example-split-layout.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'example-split-layout',
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
    .split__header {
      flex-shrink: 0;
      border-bottom: 1px solid var(--ngaf-chat-separator, #e5e5e5);
    }
    .split__header:empty { display: none; }
    .split__body {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }
    .split__primary {
      flex: 1;
      overflow-y: auto;
      padding: 1rem;
      min-height: 200px;
    }
    .split__secondary {
      width: 100%;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      border-top: 1px solid var(--ngaf-chat-separator, #e5e5e5);
      background: var(--ngaf-chat-surface-alt, #fafafa);
    }
    .split__secondary:empty { display: none; }
    .split__footer { flex-shrink: 0; }
    .split__footer:empty { display: none; }
    @media (min-width: 768px) {
      .split__body { flex-direction: row; }
      .split__primary { padding: 1.5rem; min-height: 0; }
      .split__secondary {
        width: 20rem;
        border-top: 0;
        border-left: 1px solid var(--ngaf-chat-separator, #e5e5e5);
      }
    }
  `,
  template: `
    <div class="split__header"><ng-content select="[header]" /></div>
    <div class="split__body">
      <div class="split__primary"><ng-content select="[primary]" /></div>
      <div class="split__secondary"><ng-content select="[secondary]" /></div>
    </div>
    <div class="split__footer"><ng-content select="[footer]" /></div>
  `,
})
export class ExampleSplitLayoutComponent {}
