// SPDX-License-Identifier: MIT
import { Component, computed, input } from '@angular/core';
import type { Spec } from '@json-render/core';

@Component({
  selector: 'a2ui-icon',
  standalone: true,
  template: `
    @if (effectiveName(); as name) {
      <span
        class="a2ui-icon material-symbols-outlined"
        [style.font-size]="size() ? size() + 'px' : '1.125rem'"
        [attr.aria-label]="name"
        role="img"
      >{{ name }}</span>
    }
  `,
  styles: [`
    /* Renders Material Symbols by ligature name (A2UI's canonical icon set).
       Relies only on the Material Symbols Outlined @font-face being present —
       host apps load the stylesheet (see README). Unknown / not-yet-loaded
       names fall back to the browser default glyph. */
    .a2ui-icon {
      font-family: 'Material Symbols Outlined';
      font-weight: normal;
      font-style: normal;
      line-height: 1;
      letter-spacing: normal;
      text-transform: none;
      white-space: nowrap;
      word-wrap: normal;
      direction: ltr;
      font-feature-settings: 'liga';
      -webkit-font-feature-settings: 'liga';
      -webkit-font-smoothing: antialiased;
      font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
      color: currentColor;
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
