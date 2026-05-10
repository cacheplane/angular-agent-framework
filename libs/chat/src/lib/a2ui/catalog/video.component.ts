// SPDX-License-Identifier: MIT
import { Component, input } from '@angular/core';

@Component({
  selector: 'a2ui-video',
  standalone: true,
  template: `
    <video
      class="w-full rounded-lg"
      [src]="url()"
      [autoplay]="autoPlay()"
      [controls]="controls()"
    ></video>
  `,
})
export class A2uiVideoComponent {
  readonly url = input<string>('');
  /** v1 prop name: autoPlay (camelCase). */
  readonly autoPlay = input<boolean>(false);
  readonly controls = input<boolean>(true);
}
