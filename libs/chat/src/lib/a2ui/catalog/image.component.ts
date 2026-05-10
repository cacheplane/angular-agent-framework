// SPDX-License-Identifier: MIT
import { Component, input } from '@angular/core';
import type { Spec } from '@json-render/core';

@Component({
  selector: 'a2ui-image',
  standalone: true,
  template: `
    <img
      class="a2ui-img"
      [src]="url()"
      [alt]="alt()"
      [style.width]="width() ? width() + 'px' : null"
      [style.height]="height() ? height() + 'px' : null"
    />
  `,
  styles: [`
    .a2ui-img {
      display: block;
      max-width: 100%;
      border-radius: var(--a2ui-shape-extra-small);
    }
  `],
})
export class A2uiImageComponent {
  readonly url = input<string>('');
  readonly alt = input<string>('');
  readonly width = input<number | null>(null);
  readonly height = input<number | null>(null);
  // Framework inputs required by the render harness.
  readonly bindings = input<Record<string, string>>({});
  readonly emit = input<(event: string) => void>(() => { /* noop */ });
  readonly loading = input<boolean>(false);
  readonly childKeys = input<string[]>([]);
  readonly spec = input<Spec | undefined>(undefined);
}
