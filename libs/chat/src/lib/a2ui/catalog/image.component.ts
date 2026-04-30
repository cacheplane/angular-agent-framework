// SPDX-License-Identifier: MIT
import { Component, input } from '@angular/core';

@Component({
  selector: 'a2ui-image',
  standalone: true,
  template: `<img [src]="url()" [alt]="alt()" class="max-w-full rounded" />`,
})
export class A2uiImageComponent {
  readonly url = input<string>('');
  readonly alt = input<string>('');
}
