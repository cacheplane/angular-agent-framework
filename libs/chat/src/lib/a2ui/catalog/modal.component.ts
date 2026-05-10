// SPDX-License-Identifier: MIT
import { Component, computed, input, signal } from '@angular/core';
import type { Spec } from '@json-render/core';
import { RenderElementComponent } from '@ngaf/render';

@Component({
  selector: 'a2ui-modal',
  standalone: true,
  imports: [RenderElementComponent],
  template: `
    <!-- Entry point (trigger): always rendered inline, e.g. a button. -->
    @if (entryPointKey(); as epKey) {
      <div (click)="open.set(true)" (keydown.enter)="open.set(true)" (keydown.space)="open.set(true)"
        role="button" tabindex="0" style="display:contents">
        <render-element [elementKey]="epKey" [spec]="spec()" />
      </div>
    }

    <!-- Modal overlay: shown when open. -->
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
          (click)="open.set(false)"
          (keydown.enter)="open.set(false)"
          (keydown.space)="open.set(false)"
        ></div>
        <div class="relative bg-gray-900 border border-white/10 rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl">
          @if (title()) {
            <h2 class="text-lg font-semibold mb-4">{{ title() }}</h2>
          }
          @if (contentKey(); as cKey) {
            <render-element [elementKey]="cKey" [spec]="spec()" />
          }
        </div>
      </div>
    }
  `,
})
export class A2uiModalComponent {
  /**
   * v1: childKeys[0] = entryPointChild (inline trigger),
   *     childKeys[1] = contentChild (modal body).
   */
  readonly childKeys = input<string[]>([]);
  readonly spec = input.required<Spec>();
  /** Resolved title string (from optional title DynamicString). */
  readonly title = input<string>('');

  protected readonly open = signal(false);

  protected readonly entryPointKey = computed(() => this.childKeys()[0] ?? null);
  protected readonly contentKey = computed(() => this.childKeys()[1] ?? null);
}
