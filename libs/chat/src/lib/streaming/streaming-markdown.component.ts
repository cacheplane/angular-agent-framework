// libs/chat/src/lib/streaming/streaming-markdown.component.ts
// SPDX-License-Identifier: MIT
import {
  Component,
  ChangeDetectionStrategy,
  ViewEncapsulation,
  computed,
  input,
} from '@angular/core';
import {
  createPartialMarkdownParser,
  materialize,
  type MarkdownDocumentNode,
  type PartialMarkdownParser,
} from '@cacheplane/partial-markdown';
import type { ViewRegistry } from '@ngaf/render';
import { CHAT_MARKDOWN_STYLES } from '../styles/chat-markdown.styles';
import { MARKDOWN_VIEW_REGISTRY } from '../markdown/markdown-view-registry';
import { MarkdownChildrenComponent } from '../markdown/markdown-children.component';
import { cacheplaneMarkdownViews } from '../markdown/cacheplane-markdown-views';

/**
 * Renders streaming markdown by walking a @cacheplane/partial-markdown AST
 * through @ngaf/render's view registry.
 *
 * Reactivity model: the live `parser.root` keeps a stable JS reference
 * across pushes (partial-markdown's identity guarantee). To make Angular
 * signals propagate downstream when the underlying tree changes, we surface
 * a materialized snapshot via `materialize()`. The snapshot shares
 * structurally — unchanged subtrees keep the SAME reference, and any
 * descendant change yields a NEW root reference. This lets Angular's
 * `Object.is` equality check both detect changes (root reference differs)
 * and short-circuit unchanged subtrees (per-node references stable).
 *
 * Override per-node-type renderers via the `[viewRegistry]` input or by
 * supplying a different `MARKDOWN_VIEW_REGISTRY` provider in the injector
 * tree.
 */
@Component({
  selector: 'chat-streaming-md',
  standalone: true,
  imports: [MarkdownChildrenComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styles: CHAT_MARKDOWN_STYLES,
  template: `
    @if (root(); as r) {
      <chat-md-children [parent]="r" />
    }
  `,
  providers: [
    {
      provide: MARKDOWN_VIEW_REGISTRY,
      useFactory: (host: ChatStreamingMdComponent) => host.resolvedRegistry(),
      deps: [ChatStreamingMdComponent],
    },
  ],
})
export class ChatStreamingMdComponent {
  readonly content = input<string>('');
  readonly streaming = input<boolean>(false);
  readonly viewRegistry = input<ViewRegistry | undefined>(undefined);

  readonly resolvedRegistry = computed(
    () => this.viewRegistry() ?? cacheplaneMarkdownViews,
  );

  // Parser instance is rebuilt only when content diverges from the prior
  // prefix (rare). For the common streaming case where content extends the
  // prior content, we push the delta and reuse the existing parser tree.
  private parser: PartialMarkdownParser = createPartialMarkdownParser();
  private prior = '';
  private finished = false;

  readonly root = computed<MarkdownDocumentNode | null>(() => {
    const c = this.content();
    const isStreaming = this.streaming();
    if (c !== this.prior) {
      if (c.startsWith(this.prior)) {
        this.parser.push(c.slice(this.prior.length));
      } else {
        // Content shrank or diverged — reset.
        this.parser = createPartialMarkdownParser();
        this.finished = false;
        if (c.length > 0) this.parser.push(c);
      }
      if (!isStreaming && !this.finished) {
        this.parser.finish();
        this.finished = true;
      }
      this.prior = c;
    } else if (!isStreaming && !this.finished) {
      // Streaming flipped to false without new content; ensure parser is finalized.
      this.parser.finish();
      this.finished = true;
    }
    // Materialize for Angular reactivity: produces a NEW root reference when
    // any descendant subtree changed; same reference when nothing changed
    // (structural sharing). This is what makes signal-based CD propagate
    // downstream changes despite the parser preserving identity.
    return materialize(this.parser.root) as MarkdownDocumentNode | null;
  });
}
