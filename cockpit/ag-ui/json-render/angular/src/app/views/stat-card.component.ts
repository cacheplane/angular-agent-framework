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
        <div class="skeleton skeleton-text skeleton-text--short"></div>
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
      border: 1px solid var(--tplane-chat-separator);
      border-radius: var(--tplane-chat-radius-card);
      background: var(--tplane-chat-surface-alt);
      backdrop-filter: blur(4px);
      min-width: 0;
    }
    .stat-card__label {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--tplane-chat-text-muted);
    }
    .stat-card__value {
      font-size: 24px;
      font-weight: 600;
      line-height: 1.1;
      color: var(--tplane-chat-text);
      font-variant-numeric: tabular-nums;
    }
    .stat-card__delta {
      font-size: 12px;
      font-weight: 500;
      font-variant-numeric: tabular-nums;
      color: var(--tplane-chat-text-muted);
    }
    .stat-card__delta[data-trend="up"] { color: var(--tplane-chat-success); }
    .stat-card__delta[data-trend="down"] { color: var(--tplane-chat-error-text); }
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
