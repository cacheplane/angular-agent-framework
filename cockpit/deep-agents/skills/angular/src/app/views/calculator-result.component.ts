import { Component, input } from '@angular/core';

@Component({
  selector: 'calculator-result',
  standalone: true,
  template: `
    <div class="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 my-1"
         style="background: var(--ngaf-chat-surface-alt); border: 1px solid var(--ngaf-chat-separator);">
      <span class="rounded-full px-2 py-0.5 text-xs font-semibold"
            style="background: rgba(74, 222, 128, 0.15); color: var(--ngaf-chat-success);">
        calculator
      </span>
      <span class="text-sm font-mono" style="color: var(--ngaf-chat-text);">
        {{ expression() }}
      </span>
      <span class="text-sm font-semibold" style="color: var(--ngaf-chat-text);">
        = {{ result() }}
      </span>
    </div>
  `,
})
export class CalculatorResultComponent {
  readonly expression = input<string>('');
  readonly result = input<string>('');
}
