// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
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
