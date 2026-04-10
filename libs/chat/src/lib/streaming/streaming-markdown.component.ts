// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  input,
  effect,
  ElementRef,
  inject,
  ChangeDetectionStrategy,
  untracked,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { createStreamingMarkdownRenderer, type StreamingMarkdownRenderer } from './streaming-markdown';
import { renderMarkdownToString } from '../styles/chat-markdown';

/**
 * Renders markdown content using a streaming append-only DOM renderer
 * during active streaming, then switches to a full marked.parse() render
 * once the content stabilises (no new content for a frame).
 *
 * This eliminates the jank caused by full innerHTML replacement on every
 * SSE token — the streaming renderer only appends new DOM nodes.
 */
@Component({
  selector: 'chat-streaming-md',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
  styles: `:host { display: block; }`,
})
export class ChatStreamingMdComponent {
  private readonly el = inject(ElementRef).nativeElement as HTMLElement;
  private readonly sanitizer = inject(DomSanitizer);

  /** Full markdown content (updated on every partial) */
  readonly content = input.required<string>();
  /** Whether the parent stream is still loading */
  readonly streaming = input<boolean>(false);

  private renderer: StreamingMarkdownRenderer | null = null;
  private lastContent = '';
  private finalised = false;

  constructor() {
    effect(() => {
      const content = this.content();
      const isStreaming = this.streaming();

      untracked(() => this.render(content, isStreaming));
    });
  }

  private render(content: string, isStreaming: boolean): void {
    if (!content) return;

    if (isStreaming) {
      // Streaming mode: use append-only renderer with deltas
      if (!this.renderer) {
        this.renderer = createStreamingMarkdownRenderer();
        this.el.textContent = '';
        this.el.appendChild(this.renderer.container);
        this.finalised = false;
      }

      // Compute delta from last known content
      const delta = content.slice(this.lastContent.length);
      this.lastContent = content;

      if (delta) {
        this.renderer.push(delta);
      }
    } else {
      // Stream complete: do a single high-quality marked.parse() render
      if (!this.finalised || content !== this.lastContent) {
        this.lastContent = content;
        this.finalised = true;
        this.renderer = null;

        this.el.innerHTML = renderMarkdownToString(content, this.sanitizer);
      }
    }
  }
}
