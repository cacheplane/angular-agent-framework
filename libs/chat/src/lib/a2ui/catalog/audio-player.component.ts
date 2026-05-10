// SPDX-License-Identifier: MIT
import { Component, input } from '@angular/core';
import type { Spec } from '@json-render/core';

@Component({
  selector: 'a2ui-audio-player',
  standalone: true,
  template: `
    <audio
      class="a2ui-audio"
      [src]="url()"
      [autoplay]="autoPlay()"
      [controls]="controls()"
    ></audio>
  `,
  styles: [`
    .a2ui-audio {
      display: block;
      width: 100%;
    }
  `],
})
export class A2uiAudioPlayerComponent {
  readonly url = input<string>('');
  /** v1 prop name: autoPlay (camelCase). */
  readonly autoPlay = input<boolean>(false);
  readonly controls = input<boolean>(true);
  // Framework inputs required by the render harness.
  readonly bindings = input<Record<string, string>>({});
  readonly emit = input<(event: string) => void>(() => { /* noop */ });
  readonly loading = input<boolean>(false);
  readonly childKeys = input<string[]>([]);
  readonly spec = input<Spec | undefined>(undefined);
}
