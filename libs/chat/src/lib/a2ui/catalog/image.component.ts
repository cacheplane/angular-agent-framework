// SPDX-License-Identifier: MIT
import { Component, input } from '@angular/core';

@Component({
  selector: 'a2ui-image',
  standalone: true,
  template: `
    <img
      [src]="url()"
      [alt]="alt()"
      [style.width]="width() ? width() + 'px' : null"
      [style.height]="height() ? height() + 'px' : null"
      class="max-w-full rounded"
    />
  `,
})
export class A2uiImageComponent {
  readonly url = input<string>('');
  readonly alt = input<string>('');
  readonly width = input<number | null>(null);
  readonly height = input<number | null>(null);
}
