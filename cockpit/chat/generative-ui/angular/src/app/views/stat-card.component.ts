// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  template: `
    <div class="rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
      <div class="text-xs font-medium uppercase tracking-wider text-white/40 mb-1">{{ label() }}</div>
      @if (isSkeleton()) {
        <div class="skeleton skeleton-value mt-2"></div>
        <div class="skeleton skeleton-text mt-1" style="width: 30%"></div>
      } @else {
        <div class="text-xl font-semibold text-white">{{ formattedValue() }}</div>
        @if (delta()) {
          <div data-testid="delta" class="text-xs mt-1" [class]="deltaColor()">{{ delta() }}</div>
        }
      }
    </div>
  `,
  styleUrls: ['./skeleton.css'],
})
export class StatCardComponent {
  readonly label = input<string>('');
  readonly value = input<string | number | null>(null);
  readonly delta = input<string | null>(null);

  readonly isSkeleton = computed(() => this.value() == null);

  readonly formattedValue = computed(() => {
    const v = this.value();
    if (v == null) return '';
    if (typeof v === 'number') return v.toLocaleString();
    return String(v);
  });

  readonly deltaColor = computed(() => {
    const d = this.delta();
    if (!d) return '';
    if (d.startsWith('+')) return 'text-emerald-400';
    if (d.startsWith('-')) return 'text-red-400';
    return 'text-white/60';
  });
}
