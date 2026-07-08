import { Component, input } from '@angular/core';

@Component({
  selector: 'calculator-result',
  standalone: true,
  template: `
    <div class="result-pill">
      <span class="result-badge">
        calculator
      </span>
      <span class="result-expression">
        {{ expression() }}
      </span>
      <span class="result-value">
        = {{ result() }}
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
      background: color-mix(in srgb, var(--tplane-chat-success) 16%, transparent);
      color: var(--tplane-chat-success);
      font-size: var(--tplane-chat-font-size-xs);
      font-weight: 700;
    }

    .result-expression {
      font: var(--tplane-chat-font-size-sm) / 1.5 var(--tplane-chat-font-mono);
    }

    .result-value {
      font-size: var(--tplane-chat-font-size-sm);
      font-weight: 700;
    }
  `],
})
export class CalculatorResultComponent {
  readonly expression = input<string>('');
  readonly result = input<string>('');
}
