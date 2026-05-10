// SPDX-License-Identifier: MIT
import { Component, computed, input } from '@angular/core';
import type { Spec } from '@json-render/core';

@Component({
  selector: 'a2ui-icon',
  standalone: true,
  template: `
    <span
      class="a2ui-icon"
      [style.font-size]="size() ? size() + 'px' : '1.125rem'"
      [attr.aria-label]="effectiveName()"
    >{{ effectiveName() }}</span>
  `,
  styles: [`
    .a2ui-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      user-select: none;
    }
  `],
})
export class A2uiIconComponent {
  /** v1 canonical prop. */
  readonly name = input<string | undefined>(undefined);
  /** Pre-v1 alias retained for back-compat. */
  readonly icon = input<string>('');
  readonly size = input<number | null>(null);
  // Framework inputs required by the render harness.
  readonly bindings = input<Record<string, string>>({});
  readonly emit = input<(event: string) => void>(() => { /* noop */ });
  readonly loading = input<boolean>(false);
  readonly childKeys = input<string[]>([]);
  readonly spec = input<Spec | undefined>(undefined);

  protected readonly effectiveName = computed(() => this.name() ?? this.icon());
}
