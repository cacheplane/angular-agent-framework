// libs/chat/src/lib/markdown/markdown-children.component.ts
// SPDX-License-Identifier: MIT
import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  computed,
  Type,
} from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import type { ViewRegistry } from '@ngaf/render';
import type { MarkdownNode } from '@cacheplane/partial-markdown';
import { MARKDOWN_VIEW_REGISTRY } from './markdown-view-registry';

/**
 * Recursively dispatches a parent node's children through the markdown view
 * registry. Each child's `type` is looked up in the registry; the resolved
 * component is rendered with `[node]` bound to that child.
 *
 * Identity-preserving: `track $any(child)` keys on the JS reference of the
 * child node. Because @cacheplane/partial-markdown preserves node identity
 * across pushes, unchanged subtrees never re-render.
 */
@Component({
  selector: 'chat-md-children',
  standalone: true,
  imports: [NgComponentOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (child of children(); track $any(child)) {
      @let comp = resolve(child);
      @if (comp) {
        <ng-container *ngComponentOutlet="comp; inputs: { node: child }" />
      }
    }
  `,
})
export class MarkdownChildrenComponent {
  readonly parent = input.required<MarkdownNode>();
  private readonly registry = inject<ViewRegistry>(MARKDOWN_VIEW_REGISTRY);

  protected readonly children = computed<readonly MarkdownNode[]>(() => {
    const p = this.parent();
    return 'children' in p && Array.isArray((p as { children?: MarkdownNode[] }).children)
      ? ((p as { children: MarkdownNode[] }).children as readonly MarkdownNode[])
      : [];
  });

  protected resolve(child: MarkdownNode): Type<unknown> | null {
    return this.registry[child.type] ?? null;
  }
}
