// SPDX-License-Identifier: MIT
import { Component, input } from '@angular/core';
import type { Spec } from '@json-render/core';

@Component({
  selector: 'a2ui-video',
  standalone: true,
  template: `
    <video
      class="a2ui-video"
      [src]="url()"
      controls
    ></video>
  `,
  styles: [`
    .a2ui-video {
      display: block;
      width: 100%;
      border-radius: var(--a2ui-shape-small);
    }
  `],
})
export class A2uiVideoComponent {
  readonly url = input<string>('');
  // Framework inputs required by the render harness.
  readonly bindings = input<Record<string, string>>({});
  readonly emit = input<(event: string) => void>(() => { /* noop */ });
  readonly loading = input<boolean>(false);
  readonly childKeys = input<string[]>([]);
  readonly spec = input<Spec | undefined>(undefined);
}
