// libs/chat/src/lib/streaming/streaming-markdown.component.ts
// SPDX-License-Identifier: MIT
import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { renderMarkdownToString } from './markdown-render';
import { isTraceEnabled, trace } from './trace';
import { CHAT_MARKDOWN_STYLES } from '../styles/chat-markdown.styles';

/**
 * Renders markdown content via marked.parse + sanitized innerHTML, coalesced
 * to one render per animation frame. No incremental renderer state, no delta
 * math — just write the latest content. Idempotent within a frame.
 *
 * The `streaming` input is informational (it can drive parent-level decisions
 * like showing a caret), but doesn't change the render strategy here.
 */
@Component({
  selector: 'chat-streaming-md',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Disable emulated view encapsulation. The component sets its content via
  // `innerHTML` (Angular's sanitized markdown render), so the resulting DOM
  // nodes never carry the `_ngcontent-xxx` attribute that emulated styles
  // require to match descendants. Without this, `chat-streaming-md ul` and
  // friends in CHAT_MARKDOWN_STYLES never apply, and bullets/headings/code
  // blocks render unstyled. We scope every selector to `chat-streaming-md`
  // in CHAT_MARKDOWN_STYLES so the rules don't leak globally.
  encapsulation: ViewEncapsulation.None,
  template: '',
  styles: CHAT_MARKDOWN_STYLES,
})
export class ChatStreamingMdComponent {
  readonly content = input.required<string>();
  readonly streaming = input<boolean>(false);

  private readonly el = inject(ElementRef).nativeElement as HTMLElement;
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);

  private rafHandle = 0;
  private pendingContent = '';

  constructor() {
    effect(() => {
      const next = this.content();
      untracked(() => this.schedule(next));
    });

    this.destroyRef.onDestroy(() => {
      if (this.rafHandle) {
        cancelAnimationFrame(this.rafHandle);
        this.rafHandle = 0;
      }
    });
  }

  private schedule(content: string): void {
    this.pendingContent = content;
    if (this.rafHandle !== 0) return;
    this.rafHandle = requestAnimationFrame(() => {
      this.rafHandle = 0;
      this.flush();
    });
  }

  private flush(): void {
    const content = this.pendingContent;
    if (!content) {
      this.el.innerHTML = '';
      return;
    }
    const start = isTraceEnabled() ? performance.now() : 0;
    this.el.innerHTML = renderMarkdownToString(content, this.sanitizer);
    if (isTraceEnabled()) {
      trace('streaming-md.flush', { contentLength: content.length, durationMs: performance.now() - start });
    }
  }
}
