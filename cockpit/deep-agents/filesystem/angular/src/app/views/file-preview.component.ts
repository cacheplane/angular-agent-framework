import { Component, input } from '@angular/core';

@Component({
  selector: 'file-preview',
  standalone: true,
  template: `
    <div class="file-card">
      <div class="file-card__head">
        <span class="file-card__path">{{ path() }}</span>
        <span class="file-card__size">{{ size() }}</span>
      </div>
      <pre class="file-card__body">{{ content() }}</pre>
    </div>
  `,
  styles: [`
    .file-card {
      margin: 0.5rem 0;
      overflow: hidden;
      border: 1px solid var(--tplane-chat-separator);
      border-radius: var(--tplane-chat-radius-card);
      background: var(--tplane-chat-surface-alt);
    }

    .file-card__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      border-bottom: 1px solid var(--tplane-chat-separator);
      background: var(--tplane-chat-bg);
    }

    .file-card__path {
      min-width: 0;
      overflow: hidden;
      color: var(--tplane-chat-text);
      font: var(--tplane-chat-font-size-sm) / 1.5 var(--tplane-chat-font-mono);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .file-card__size {
      flex: 0 0 auto;
      color: var(--tplane-chat-text-muted);
      font-size: var(--tplane-chat-font-size-xs);
    }

    .file-card__body {
      margin: 0;
      padding: 1rem;
      overflow-x: auto;
      background: var(--tplane-chat-surface-alt);
      color: var(--tplane-chat-text);
      font: var(--tplane-chat-font-size-xs) / 1.5 var(--tplane-chat-font-mono);
      overflow-wrap: anywhere;
      white-space: pre-wrap;
    }
  `],
})
export class FilePreviewComponent {
  readonly path = input<string>('');
  readonly content = input<string>('');
  readonly size = input<string>('');
}
