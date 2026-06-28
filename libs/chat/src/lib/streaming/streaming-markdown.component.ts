// libs/chat/src/lib/streaming/streaming-markdown.component.ts
// SPDX-License-Identifier: MIT
import {
  Component,
  ChangeDetectionStrategy,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import {
  createPartialMarkdownParser,
  materialize,
  type MarkdownDocumentNode,
  type PartialMarkdownParser,
} from '@cacheplane/partial-markdown';
import type { ViewRegistry } from '@threadplane/render';
import { CHAT_MARKDOWN_STYLES } from '../styles/chat-markdown.styles';
import { MARKDOWN_VIEW_REGISTRY } from '../markdown/markdown-view-registry';
import { MarkdownChildrenComponent } from '../markdown/markdown-children.component';
import { cacheplaneMarkdownViews } from '../markdown/cacheplane-markdown-views';
import { CitationsResolverService } from '../markdown/citations-resolver.service';

// How long streaming must be false AND content stable before we finalize the
// parser. finish() is only needed to mark final node status (not used visually)
// and to revert a genuinely-truncated trailing construct to CommonMark — the
// live `parser.root` projection already renders everything during streaming, so
// this delay has NO visual cost. It must comfortably exceed real inter-chunk
// gaps (e.g. the pause between a table's header row and its delimiter row) and
// any `streaming` flag flap, so finalize never fires mid-stream and reverts an
// in-progress table to raw "| a | b |" text.
const FINALIZE_DEBOUNCE_MS = 600;

/**
 * Renders streaming markdown by walking a @cacheplane/partial-markdown AST
 * through @threadplane/render's view registry.
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

  private readonly resolver = inject(CitationsResolverService, { optional: true });

  constructor() {
    effect(() => {
      const r = this.root();
      if (this.resolver && r) {
        this.resolver.markdownDefs.set(r.citations ?? new Map());
      }
    });

    // Debounced finalization. `finish()` is terminal and DESTRUCTIVE: it reverts
    // an incomplete trailing construct to its CommonMark fallback — e.g. a table
    // header before its delimiter row becomes raw "| a | b |" paragraph text. We
    // must therefore never finalize while tokens are still arriving. The
    // `streaming` input is not a reliable "still arriving" signal — it can flap
    // false mid-stream, and at cold start it can read false for an entire live
    // stream — so we finalize only once streaming is false AND no new content
    // has arrived for a short, imperceptible window. Any new content or a
    // streaming=true flap re-arms the timer, so finalize fires exactly once,
    // after the stream truly stops. Until then the live `parser.root` projection
    // (0.5.x) renders the in-progress content, including streaming tables.
    let timer: ReturnType<typeof setTimeout> | null = null;
    effect((onCleanup) => {
      const isStreaming = this.streaming();
      this.content(); // re-arm whenever new content arrives
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (isStreaming || this.finished) return;
      timer = setTimeout(() => {
        timer = null;
        if (this.streaming() || this.finished) return;
        if (!this.prior.endsWith('\n')) this.parser.push('\n');
        this.parser.finish();
        this.finished = true;
        this.finalizeTick.update((v) => v + 1);
      }, FINALIZE_DEBOUNCE_MS);
      onCleanup(() => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      });
    });
  }

  // Parser instance is rebuilt only when content diverges from the prior
  // prefix (rare). For the common streaming case where content extends the
  // prior content, we push the delta and reuse the existing parser tree.
  private parser: PartialMarkdownParser = createPartialMarkdownParser();
  private prior = '';
  private finished = false;
  // Bumped by the debounced finalizer so the `root` computed re-materializes
  // the now-finished parser tree.
  private readonly finalizeTick = signal(0);

  readonly root = computed<MarkdownDocumentNode | null>(() => {
    const c = this.content();
    this.finalizeTick(); // re-materialize after a debounced finalize
    if (c !== this.prior) {
      // Re-parse from scratch when the content diverged from the prior prefix,
      // OR when the parser was already finalized — finish() is terminal, so
      // pushing further deltas into a finished parser corrupts its state. A
      // transient `streaming=false` mid-stream that finalized early thus
      // recovers here: new content rebuilds an open, projecting parser.
      if (c.startsWith(this.prior) && !this.finished) {
        this.parser.push(c.slice(this.prior.length));
      } else {
        this.parser = createPartialMarkdownParser();
        this.finished = false;
        if (c.length > 0) this.parser.push(c);
      }
      this.prior = c;
    }
    // Materialize for Angular reactivity: produces a NEW root reference when
    // any descendant subtree changed; same reference when nothing changed
    // (structural sharing). This is what makes signal-based CD propagate
    // downstream changes despite the parser preserving identity.
    return materialize(this.parser.root) as MarkdownDocumentNode | null;
  });
}
