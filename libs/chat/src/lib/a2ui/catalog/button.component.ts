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
      [class]="primary() ? 'a2ui-btn a2ui-btn--primary' : 'a2ui-btn a2ui-btn--secondary'"
      [disabled]="disabled()"
      (click)="handleClick()"
    >
      @for (key of childKeys(); track key) {
        <render-element [elementKey]="key" [spec]="spec()" />
      }
    </button>
  `,
  styles: [`
    .a2ui-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: var(--a2ui-spacing-2) var(--a2ui-spacing-4);
      border-radius: var(--a2ui-shape-small);
      font-size: var(--a2ui-typography-body-size);
      font-weight: 500;
      cursor: pointer;
      transition: background var(--a2ui-motion-duration-short) var(--a2ui-motion-easing-standard),
                  opacity var(--a2ui-motion-duration-short) var(--a2ui-motion-easing-standard);
      border: none;
    }
    .a2ui-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .a2ui-btn--primary {
      background: var(--a2ui-primary);
      color: var(--a2ui-on-primary);
    }
    .a2ui-btn--primary:hover:not(:disabled) { background: var(--a2ui-primary-hover); }
    .a2ui-btn--secondary {
      background: var(--a2ui-surface-variant);
      color: var(--a2ui-on-surface);
      border: 1px solid var(--a2ui-outline);
    }
    .a2ui-btn--secondary:hover:not(:disabled) { background: var(--a2ui-outline); }
  `],
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
