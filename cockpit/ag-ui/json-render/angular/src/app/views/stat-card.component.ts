// SPDX-License-Identifier: MIT
import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  template: `
    <div class="stat-card">
      <div class="stat-card__label">{{ label() }}</div>
      @if (isSkeleton()) {
        <div class="skeleton skeleton-value"></div>
        <div class="skeleton skeleton-text" style="width: 30%"></div>
      } @else {
        <div class="stat-card__value">{{ formattedValue() }}</div>
        @if (delta()) {
          <div data-testid="delta" class="stat-card__delta" [attr.data-trend]="deltaTrend()">
            {{ delta() }}
          </div>
        }
      }
    </div>
  `,
  styleUrls: ['./skeleton.css'],
  styles: [`
    .stat-card {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 16px 18px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.03);
      backdrop-filter: blur(4px);
      min-width: 0;
    }
    .stat-card__label {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.45);
    }
    .stat-card__value {
      font-size: 24px;
      font-weight: 600;
      line-height: 1.1;
      color: rgba(255, 255, 255, 0.95);
      font-variant-numeric: tabular-nums;
    }
    .stat-card__delta {
      font-size: 12px;
      font-weight: 500;
      font-variant-numeric: tabular-nums;
      color: rgba(255, 255, 255, 0.55);
    }
    .stat-card__delta[data-trend="up"] { color: #5cd393; }
    .stat-card__delta[data-trend="down"] { color: #f08585; }
  `],
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

  readonly deltaTrend = computed((): 'up' | 'down' | 'flat' => {
    const d = this.delta();
    if (!d) return 'flat';
    if (d.startsWith('+')) return 'up';
    if (d.startsWith('-') || d.startsWith('−')) return 'down';
    return 'flat';
  });
}
