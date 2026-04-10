// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, input } from '@angular/core';

@Component({
  selector: 'a2ui-video',
  standalone: true,
  template: `
    <video
      class="w-full rounded-lg"
      [src]="url()"
      [poster]="poster()"
      [autoplay]="autoplay()"
      [controls]="controls()"
    ></video>
  `,
})
export class A2uiVideoComponent {
  readonly url = input.required<string>();
  readonly poster = input<string>('');
  readonly autoplay = input<boolean>(false);
  readonly controls = input<boolean>(true);
}
