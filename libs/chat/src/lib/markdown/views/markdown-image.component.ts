// libs/chat/src/lib/markdown/views/markdown-image.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import type { MarkdownImageNode } from '@cacheplane/partial-markdown';

@Component({
  selector: 'md-image',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<img [src]="node().url" [alt]="node().alt" [attr.title]="node().title || null" />`,
})
export class MarkdownImageComponent {
  readonly node = input.required<MarkdownImageNode>();
}
