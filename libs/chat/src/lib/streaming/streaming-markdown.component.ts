// libs/chat/src/lib/streaming/streaming-markdown.component.ts
// SPDX-License-Identifier: MIT
import {
  ChangeDetectionStrategy,
  Component,
  InjectionToken,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  input,
  isDevMode,
} from '@angular/core';
import {
  createPartialMarkdownParser,
  materialize,
  type MarkdownDocumentNode,
  type PartialMarkdownParser,
} from '@cacheplane/partial-markdown';
import type { ViewRegistry } from '@threadplane/render';
import { CitationsResolverService } from '../markdown/citations-resolver.service';
import { MarkdownChildrenComponent } from '../markdown/markdown-children.component';
import { MARKDOWN_VIEW_REGISTRY } from '../markdown/markdown-view-registry';
import { cacheplaneMarkdownViews } from '../markdown/cacheplane-markdown-views';
import { CHAT_MARKDOWN_STYLES } from '../styles/chat-markdown.styles';

export interface StreamingMarkdownDocument {
  readonly generation: string;
  readonly phase: 'streaming' | 'complete';
  readonly content: string;
}

export type StreamingMarkdownContractViolationPolicy = 'throw' | 'rebuild';

export const STREAMING_MARKDOWN_CONTRACT_VIOLATION_POLICY =
  new InjectionToken<StreamingMarkdownContractViolationPolicy>(
    'STREAMING_MARKDOWN_CONTRACT_VIOLATION_POLICY',
    {
      providedIn: 'root',
      factory: () => (isDevMode() ? 'throw' : 'rebuild'),
    }
  );

type StreamingMarkdownParserFactory = () => PartialMarkdownParser;
type ContractViolationReason =
  | 'complete-to-streaming'
  | 'post-completion-content-mutation'
  | 'content-shrink'
  | 'content-divergence';

/** @internal Test seam for verifying parser lifecycle ordering. */
export const STREAMING_MARKDOWN_PARSER_FACTORY =
  new InjectionToken<StreamingMarkdownParserFactory>(
    'STREAMING_MARKDOWN_PARSER_FACTORY',
    {
      providedIn: 'root',
      factory: () => createPartialMarkdownParser,
    }
  );

function contractViolation(
  prior: StreamingMarkdownDocument,
  supplied: StreamingMarkdownDocument,
  reason: ContractViolationReason
): Error {
  return new Error(
    `Streaming markdown document contract violation: ${reason}; ` +
      `generation ${JSON.stringify(supplied.generation)} cannot transition ` +
      `from ${prior.phase} content of length ${prior.content.length} ` +
      `to ${supplied.phase} content of length ${supplied.content.length}.`
  );
}

function contractViolationReason(
  prior: StreamingMarkdownDocument,
  supplied: StreamingMarkdownDocument
): ContractViolationReason | null {
  if (prior.phase === 'complete') {
    return supplied.phase === 'streaming'
      ? 'complete-to-streaming'
      : 'post-completion-content-mutation';
  }
  if (supplied.content.length < prior.content.length) return 'content-shrink';
  if (!supplied.content.startsWith(prior.content)) return 'content-divergence';
  return null;
}

/**
 * Renders one explicitly-versioned markdown document through the shared view
 * registry. A generation owns one parser session; append-only updates preserve
 * parser and subtree identity, while generation changes replace the session.
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
  readonly document = input.required<StreamingMarkdownDocument>();
  readonly viewRegistry = input<ViewRegistry | undefined>(undefined);

  readonly resolvedRegistry = computed(
    () => this.viewRegistry() ?? cacheplaneMarkdownViews
  );

  private readonly resolver = inject(CitationsResolverService, {
    optional: true,
  });
  private readonly violationPolicy = inject(
    STREAMING_MARKDOWN_CONTRACT_VIOLATION_POLICY
  );
  private readonly createParser = inject(STREAMING_MARKDOWN_PARSER_FACTORY);

  private parser: PartialMarkdownParser | null = null;
  private prior: StreamingMarkdownDocument | null = null;
  private materializedRoot: MarkdownDocumentNode | null = null;

  readonly root = computed<MarkdownDocumentNode | null>(() => {
    this.process(this.document());
    return this.materializedRoot;
  });

  constructor() {
    effect(() => {
      const root = this.root();
      if (this.resolver) {
        this.resolver.markdownDefs.set(root?.citations ?? new Map());
      }
    });
  }

  private process(supplied: StreamingMarkdownDocument): void {
    const prior = this.prior;
    if (!prior || supplied.generation !== prior.generation) {
      this.replaceFrom(supplied);
      return;
    }

    if (supplied.phase === prior.phase && supplied.content === prior.content) {
      return;
    }

    const violationReason = contractViolationReason(prior, supplied);
    if (violationReason) {
      if (this.violationPolicy === 'throw') {
        throw contractViolation(prior, supplied, violationReason);
      }
      this.replaceFrom(supplied);
      return;
    }

    const parser = this.parser as PartialMarkdownParser;
    const delta = supplied.content.slice(prior.content.length);
    if (delta.length > 0) parser.push(delta);
    if (supplied.phase === 'complete') parser.finish();
    this.materializedRoot = materialize(
      parser.root
    ) as MarkdownDocumentNode | null;
    this.prior = { ...supplied };
  }

  private replaceFrom(supplied: StreamingMarkdownDocument): void {
    const parser = this.createParser();
    parser.push(supplied.content);
    if (supplied.phase === 'complete') parser.finish();
    const root = materialize(parser.root) as MarkdownDocumentNode | null;

    this.parser = parser;
    this.prior = { ...supplied };
    this.materializedRoot = root;
  }
}
