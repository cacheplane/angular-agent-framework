// SPDX-License-Identifier: MIT
import { Component, input } from '@angular/core';

@Component({
  selector: 'a2ui-audio-player',
  standalone: true,
  template: `
    <audio
      class="w-full"
      [src]="url()"
      [autoplay]="autoplay()"
      [controls]="controls()"
    ></audio>
  `,
})
export class A2uiAudioPlayerComponent {
  readonly url = input.required<string>();
  readonly autoplay = input<boolean>(false);
  readonly controls = input<boolean>(true);
}
