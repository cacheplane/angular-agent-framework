import { Component, input } from '@angular/core';

@Component({
  selector: 'calculator-result',
  standalone: true,
  template: `
    <div class="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 my-1"
         style="background: var(--chat-bg-alt); border: 1px solid var(--chat-border);">
      <span class="rounded-full px-2 py-0.5 text-xs font-semibold"
            style="background: rgba(74, 222, 128, 0.15); color: var(--chat-success, #4ade80);">
        calculator
      </span>
      <span class="text-sm font-mono" style="color: var(--chat-text);">
        {{ expression() }}
      </span>
      <span class="text-sm font-semibold" style="color: var(--chat-text);">
        = {{ result() }}
      </span>
    </div>
  `,
})
export class CalculatorResultComponent {
  readonly expression = input<string>('');
  readonly result = input<string>('');
}
