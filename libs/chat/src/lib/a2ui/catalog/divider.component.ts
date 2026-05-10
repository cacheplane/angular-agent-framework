// SPDX-License-Identifier: MIT
import { Component, computed, input } from '@angular/core';
import type { Spec } from '@json-render/core';

@Component({
  selector: 'a2ui-divider',
  standalone: true,
  template: `
    @if (orientation() === 'vertical') {
      <div class="a2ui-divider a2ui-divider--vertical"></div>
    } @else {
      <hr class="a2ui-divider a2ui-divider--horizontal" />
    }
  `,
  styles: [`
    .a2ui-divider--horizontal {
      display: block;
      width: 100%;
      border: none;
      border-top: 1px solid var(--a2ui-outline);
      margin: var(--a2ui-spacing-2) 0;
    }
    .a2ui-divider--vertical {
      display: inline-block;
      align-self: stretch;
      width: 1px;
      background: var(--a2ui-outline);
      margin: 0 var(--a2ui-spacing-2);
    }
  `],
})
export class A2uiDividerComponent {
  /** Canonical v1 spec name. The LLM emits this. */
  readonly axis = input<'horizontal' | 'vertical' | undefined>(undefined);
  /** Older alias retained for json-render usage and back-compat. */
  readonly direction = input<'horizontal' | 'vertical'>('horizontal');
  /** Effective axis — `axis` wins if provided, otherwise fall back to `direction`. */
  protected readonly orientation = computed<'horizontal' | 'vertical'>(() =>
    this.axis() ?? this.direction()
  );
  // Framework inputs required by the render harness.
  readonly bindings = input<Record<string, string>>({});
  readonly emit = input<(event: string) => void>(() => { /* noop */ });
  readonly loading = input<boolean>(false);
  readonly childKeys = input<string[]>([]);
  readonly spec = input<Spec | undefined>(undefined);
}
