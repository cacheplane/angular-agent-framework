// SPDX-License-Identifier: MIT
import { Component, input } from '@angular/core';
import type { Spec } from '@json-render/core';
import { RenderElementComponent } from '@cacheplane/render';
import { emitBinding } from './emit-binding';

@Component({
  selector: 'a2ui-modal',
  standalone: true,
  imports: [RenderElementComponent],
  template: `
    @if (open()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center"
        role="dialog"
        aria-modal="true"
      >
        <div
          class="absolute inset-0 bg-black/60 backdrop-blur-sm"
          role="button"
          tabindex="0"
          aria-label="Dismiss dialog"
          (click)="onBackdropClick()"
          (keydown.enter)="onBackdropClick()"
          (keydown.space)="onBackdropClick()"
        ></div>
        <div class="relative bg-gray-900 border border-white/10 rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl">
          @if (title()) {
            <h2 class="text-lg font-semibold mb-4">{{ title() }}</h2>
          }
          @for (key of childKeys(); track key) {
            <render-element [elementKey]="key" [spec]="spec()" />
          }
        </div>
      </div>
    }
  `,
})
export class A2uiModalComponent {
  readonly title = input<string>('');
  readonly open = input<boolean>(false);
  readonly childKeys = input<string[]>([]);
  readonly spec = input.required<Spec>();
  readonly dismissible = input<boolean>(true);
  readonly _bindings = input<Record<string, string>>({});
  readonly emit = input<(event: string) => void>(() => { /* noop */ });

  onBackdropClick(): void {
    if (!this.dismissible()) return;
    emitBinding(this.emit(), this._bindings(), 'open', false);
  }
}
