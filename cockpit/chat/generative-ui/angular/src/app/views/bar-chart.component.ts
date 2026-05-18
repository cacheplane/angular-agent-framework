// SPDX-License-Identifier: MIT
import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-bar-chart',
  standalone: true,
  template: `
    <div class="chart-card">
      <div class="chart-card__title">{{ title() }}</div>
      @if (isSkeleton()) {
        <div class="skeleton skeleton-chart"></div>
      } @else {
        <svg
          [attr.viewBox]="'0 0 ' + width + ' ' + height"
          class="chart-card__svg"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          [attr.aria-label]="title()"
        >
          <!-- Baseline -->
          <line
            [attr.x1]="padding.left"
            [attr.x2]="width - padding.right"
            [attr.y1]="height - padding.bottom"
            [attr.y2]="height - padding.bottom"
            stroke="rgba(255,255,255,0.08)"
            stroke-width="1"
          />
          @for (bar of bars(); track $index) {
            <rect
              class="bar"
              [attr.x]="bar.x"
              [attr.y]="bar.y"
              [attr.width]="bar.w"
              [attr.height]="bar.h"
              [attr.rx]="3"
              fill="url(#bar-gradient)"
            />
            <text
              [attr.x]="bar.x + bar.w / 2"
              [attr.y]="bar.y - 6"
              text-anchor="middle"
              fill="rgba(255,255,255,0.7)"
              font-size="11"
              font-weight="500"
            >{{ bar.value }}</text>
            <text
              [attr.x]="bar.x + bar.w / 2"
              [attr.y]="height - padding.bottom + 16"
              text-anchor="middle"
              fill="rgba(255,255,255,0.5)"
              font-size="11"
            >{{ bar.label }}</text>
          }
          <defs>
            <linearGradient id="bar-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#e0b87a" stop-opacity="1"/>
              <stop offset="100%" stop-color="#d4aa6a" stop-opacity="0.75"/>
            </linearGradient>
          </defs>
        </svg>
      }
    </div>
  `,
  styleUrls: ['./skeleton.css'],
  styles: [`
    .chart-card {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px 18px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.03);
      backdrop-filter: blur(4px);
    }
    .chart-card__title {
      font-size: 13px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.65);
      letter-spacing: 0.01em;
    }
    .chart-card__svg {
      width: 100%;
      height: auto;
      max-height: 280px;
      display: block;
    }
    .bar {
      transition: opacity 120ms ease;
    }
    .bar:hover {
      opacity: 0.85;
    }
  `],
})
export class BarChartComponent {
  readonly title = input<string>('');
  readonly data = input<Record<string, unknown>[] | null>(null);
  readonly labelKey = input<string>('');
  readonly valueKey = input<string>('');

  readonly width = 400;
  readonly height = 220;
  readonly padding = { top: 28, right: 16, bottom: 28, left: 16 };

  readonly isSkeleton = computed(() => this.data() == null);

  readonly bars = computed(() => {
    const d = this.data();
    if (!d || d.length === 0) return [];
    const lk = this.labelKey();
    const vk = this.valueKey();
    const values = d.map(item => Number(item[vk]) || 0);
    const maxVal = Math.max(...values) || 1;
    const plotW = this.width - this.padding.left - this.padding.right;
    const plotH = this.height - this.padding.top - this.padding.bottom;
    const gap = 12;
    const barW = (plotW - gap * (d.length - 1)) / d.length;

    return d.map((item, i) => {
      const val = Number(item[vk]) || 0;
      const h = (val / maxVal) * plotH;
      return {
        x: this.padding.left + i * (barW + gap),
        y: this.padding.top + plotH - h,
        w: barW,
        h,
        label: String(item[lk] ?? ''),
        value: val.toLocaleString(),
      };
    });
  });
}
