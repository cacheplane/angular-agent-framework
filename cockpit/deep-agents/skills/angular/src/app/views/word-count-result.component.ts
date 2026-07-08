import { Component, input } from '@angular/core';

@Component({
  selector: 'word-count-result',
  standalone: true,
  template: `
    <div class="result-pill">
      <span class="result-badge">
        word_count
      </span>
      <span class="result-expression">
        {{ count() }}
      </span>
      <span class="result-value">
        words
      </span>
    </div>
  `,
  styles: [`
    .result-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0.25rem 0;
      padding: 0.375rem 0.75rem;
      border: 1px solid var(--tplane-chat-separator);
      border-radius: var(--tplane-chat-radius-card);
      background: var(--tplane-chat-surface-alt);
      color: var(--tplane-chat-text);
    }

    .result-badge {
      display: inline-flex;
      align-items: center;
      border-radius: var(--tplane-chat-radius-launcher);
      padding: 0.125rem 0.5rem;
      background: var(--tplane-chat-warning-bg);
      color: var(--tplane-chat-warning-text);
      font-size: var(--tplane-chat-font-size-xs);
      font-weight: 700;
    }

    .result-expression {
      font: 700 var(--tplane-chat-font-size-sm) / 1.5 var(--tplane-chat-font-mono);
    }

    .result-value {
      color: var(--tplane-chat-text-muted);
      font-size: var(--tplane-chat-font-size-sm);
    }
  `],
})
export class WordCountResultComponent {
  readonly count = input<string>('');
  readonly text = input<string>('');
}
