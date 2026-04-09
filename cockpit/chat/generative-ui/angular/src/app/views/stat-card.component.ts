// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  template: `
    <div class="rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
      <div class="text-xs font-medium uppercase tracking-wider text-white/40 mb-1">{{ label() }}</div>
      <div class="text-xl font-semibold text-white">{{ value() }}</div>
    </div>
  `,
})
export class StatCardComponent {
  readonly label = input<string>('');
  readonly value = input<string>('');
}
