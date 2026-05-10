// SPDX-License-Identifier: MIT
import { Component, input } from '@angular/core';
import type { Spec } from '@json-render/core';

@Component({
  selector: 'a2ui-icon',
  standalone: true,
  template: `
    <span
      class="inline-flex items-center justify-center select-none"
      [style.font-size]="size() ? size() + 'px' : '1.125rem'"
    >{{ icon() }}</span>
  `,
})
export class A2uiIconComponent {
  /** v1 prop name: icon (resolved string, e.g. a Unicode symbol or ligature name). */
  readonly icon = input<string>('');
  readonly size = input<number | null>(null);
  // Framework inputs required by the render harness.
  readonly bindings = input<Record<string, string>>({});
  readonly emit = input<(event: string) => void>(() => { /* noop */ });
  readonly loading = input<boolean>(false);
  readonly childKeys = input<string[]>([]);
  readonly spec = input<Spec | undefined>(undefined);
}
