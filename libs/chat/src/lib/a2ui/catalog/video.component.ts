// SPDX-License-Identifier: MIT
import { Component, input } from '@angular/core';
import type { Spec } from '@json-render/core';

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
  // Framework inputs required by the render harness.
  readonly bindings = input<Record<string, string>>({});
  readonly emit = input<(event: string) => void>(() => { /* noop */ });
  readonly loading = input<boolean>(false);
  readonly childKeys = input<string[]>([]);
  readonly spec = input<Spec | undefined>(undefined);
}
