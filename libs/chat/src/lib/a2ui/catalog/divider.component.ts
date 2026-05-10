// SPDX-License-Identifier: MIT
import { Component, computed, input } from '@angular/core';
import type { Spec } from '@json-render/core';

@Component({
  selector: 'a2ui-divider',
  standalone: true,
  template: `
    @if (orientation() === 'vertical') {
      <div class="inline-block self-stretch border-l border-white/10 mx-2"></div>
    } @else {
      <hr class="border-white/10 my-2" />
    }
  `,
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
