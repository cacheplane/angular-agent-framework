// SPDX-License-Identifier: MIT
import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-bar-chart',
  standalone: true,
  template: `
    <div class="rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
      <div class="text-sm font-medium text-white/60 mb-3">{{ title() }}</div>
      @if (isSkeleton()) {
        <div class="skeleton skeleton-chart"></div>
      } @else {
        <svg [attr.viewBox]="'0 0 ' + width + ' ' + height" class="w-full" preserveAspectRatio="xMidYMid meet">
          @for (bar of bars(); track $index) {
            <!-- Bar -->
            <rect class="bar" [attr.x]="bar.x" [attr.y]="bar.y" [attr.width]="bar.w" [attr.height]="bar.h" fill="#d4aa6a" rx="2" />
            <!-- Value above bar -->
            <text [attr.x]="bar.x + bar.w / 2" [attr.y]="bar.y - 6" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="10">{{ bar.value }}</text>
            <!-- Label below bar -->
            <text [attr.x]="bar.x + bar.w / 2" [attr.y]="height - 4" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-size="10">{{ bar.label }}</text>
          }
        </svg>
      }
    </div>
  `,
  styleUrls: ['./skeleton.css'],
})
export class BarChartComponent {
  readonly title = input<string>('');
  readonly data = input<Record<string, unknown>[] | null>(null);
  readonly labelKey = input<string>('');
  readonly valueKey = input<string>('');

  readonly width = 400;
  readonly height = 200;
  readonly padding = { top: 30, right: 20, bottom: 30, left: 20 };

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
    const gap = 8;
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
