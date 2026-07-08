import { Component, input } from '@angular/core';

@Component({
  selector: 'code-execution',
  standalone: true,
  template: `
    <div class="exec-view">
      <div class="exec-view__head">
        Code Execution
      </div>
      <pre class="exec-view__body code">{{ code() }}</pre>
      @if (stdout()) {
        <div class="exec-view__section">
          <div class="exec-view__label exec-view__label--success">stdout</div>
          <pre class="code code--success">{{ stdout() }}</pre>
        </div>
      }
      @if (stderr()) {
        <div class="exec-view__section">
          <div class="exec-view__label exec-view__label--error">stderr</div>
          <pre class="code code--error">{{ stderr() }}</pre>
        </div>
      }
    </div>
  `,
  styles: [`
    .exec-view {
      margin: 0.5rem 0;
      overflow: hidden;
      border: 1px solid var(--tplane-chat-separator);
      border-radius: var(--tplane-chat-radius-card);
      background: var(--tplane-chat-surface-alt);
    }

    .exec-view__head {
      padding: 0.5rem 1rem;
      border-bottom: 1px solid var(--tplane-chat-separator);
      background: var(--tplane-chat-bg);
      color: var(--tplane-chat-text-muted);
      font-size: var(--tplane-chat-font-size-xs);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }

    .exec-view__body {
      padding: 1rem;
      background: var(--tplane-chat-surface-alt);
      color: var(--tplane-chat-text);
    }

    .exec-view__section {
      padding: 0.5rem 1rem;
      border-top: 1px solid var(--tplane-chat-separator);
    }

    .exec-view__label {
      margin-bottom: 0.25rem;
      color: var(--tplane-chat-text-muted);
      font-size: var(--tplane-chat-font-size-xs);
      font-weight: 700;
    }

    .exec-view__label--success {
      color: var(--tplane-chat-success);
    }

    .exec-view__label--error {
      color: var(--tplane-chat-error-text);
    }

    .code {
      margin: 0;
      padding: 0.5rem;
      overflow-x: auto;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      border-radius: var(--tplane-chat-radius-card);
      background: var(--tplane-chat-surface);
      color: var(--tplane-chat-text);
      font: var(--tplane-chat-font-size-xs) / 1.5 var(--tplane-chat-font-mono);
    }

    .code--success {
      color: var(--tplane-chat-success);
    }

    .code--error {
      color: var(--tplane-chat-error-text);
    }
  `],
})
export class CodeExecutionComponent {
  readonly code = input<string>('');
  readonly stdout = input<string>('');
  readonly stderr = input<string>('');
}
