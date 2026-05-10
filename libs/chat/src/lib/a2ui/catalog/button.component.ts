// SPDX-License-Identifier: MIT
import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import type { Spec } from '@json-render/core';
import { RenderElementComponent } from '@ngaf/render';

@Component({
  selector: 'a2ui-button',
  standalone: true,
  imports: [RenderElementComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      class="px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center justify-center"
      [class]="primary()
        ? 'bg-blue-600 hover:bg-blue-700 text-white'
        : 'bg-transparent border border-white/20 hover:bg-white/10 text-white/80'"
      [disabled]="disabled()"
      (click)="handleClick()"
    >
      @for (key of childKeys(); track key) {
        <render-element [elementKey]="key" [spec]="spec()" />
      }
    </button>
  `,
})
export class A2uiButtonComponent {
  /** v1: child Text component is rendered inside the button via childKeys. */
  readonly childKeys = input<string[]>([]);
  readonly spec = input.required<Spec>();
  readonly primary = input<boolean>(true);
  readonly disabled = input<boolean>(false);
  readonly emit = input<(event: string) => void>(() => { /* noop */ });
  // Framework inputs required by the render harness.
  readonly bindings = input<Record<string, string>>({});
  readonly loading = input<boolean>(false);

  handleClick(): void {
    this.emit()('click');
  }
}
