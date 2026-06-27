import { Component, input } from '@angular/core';

@Component({
  selector: 'word-count-result',
  standalone: true,
  template: `
    <div class="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 my-1"
         style="background: var(--tplane-chat-surface-alt); border: 1px solid var(--tplane-chat-separator);">
      <span class="rounded-full px-2 py-0.5 text-xs font-semibold"
            style="background: rgba(251, 191, 36, 0.15); color: var(--tplane-chat-warning-text);">
        word_count
      </span>
      <span class="text-sm font-semibold font-mono" style="color: var(--tplane-chat-text);">
        {{ count() }}
      </span>
      <span class="text-sm" style="color: var(--tplane-chat-text-muted);">
        words
      </span>
    </div>
  `,
})
export class WordCountResultComponent {
  readonly count = input<string>('');
  readonly text = input<string>('');
}
