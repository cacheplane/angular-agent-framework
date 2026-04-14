// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-line-chart',
  standalone: true,
  template: `
    <div class="rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
      <div class="text-sm font-medium text-white/60 mb-3">{{ title() }}</div>
      @if (isSkeleton()) {
        <div class="skeleton skeleton-chart"></div>
      } @else {
        <svg [attr.viewBox]="'0 0 ' + width + ' ' + height" class="w-full" preserveAspectRatio="xMidYMid meet">
          <!-- Grid lines -->
          @for (y of yGridLines(); track y.value) {
            <line [attr.x1]="padding.left" [attr.y1]="y.y" [attr.x2]="width - padding.right" [attr.y2]="y.y" stroke="rgba(255,255,255,0.06)" />
            <text [attr.x]="padding.left - 6" [attr.y]="y.y + 4" text-anchor="end" fill="rgba(255,255,255,0.3)" font-size="10">{{ y.label }}</text>
          }
          <!-- Line -->
          <polyline [attr.points]="polylinePoints()" fill="none" stroke="#d4aa6a" stroke-width="2" stroke-linejoin="round" />
          <!-- Data points -->
          @for (pt of points(); track $index) {
            <circle [attr.cx]="pt.x" [attr.cy]="pt.y" r="3" fill="#d4aa6a" />
          }
          <!-- X-axis labels -->
          @for (pt of xLabels(); track $index) {
            <text [attr.x]="pt.x" [attr.y]="height - 4" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-size="10">{{ pt.label }}</text>
          }
        </svg>
      }
    </div>
  `,
  styleUrls: ['./skeleton.css'],
})
export class LineChartComponent {
  readonly title = input<string>('');
  readonly data = input<Record<string, unknown>[] | null>(null);
  readonly xKey = input<string>('');
  readonly yKey = input<string>('');

  readonly width = 400;
  readonly height = 200;
  readonly padding = { top: 20, right: 20, bottom: 30, left: 50 };

  readonly isSkeleton = computed(() => this.data() == null);

  readonly points = computed(() => {
    const d = this.data();
    if (!d || d.length === 0) return [];
    const xk = this.xKey();
    const yk = this.yKey();
    const values = d.map(item => Number(item[yk]) || 0);
    const yMin = Math.min(...values);
    const yMax = Math.max(...values);
    const yRange = yMax - yMin || 1;
    const plotW = this.width - this.padding.left - this.padding.right;
    const plotH = this.height - this.padding.top - this.padding.bottom;

    return d.map((item, i) => ({
      x: this.padding.left + (d.length > 1 ? (i / (d.length - 1)) * plotW : plotW / 2),
      y: this.padding.top + plotH - ((Number(item[yk]) || 0) - yMin) / yRange * plotH,
      label: String(item[xk] ?? ''),
    }));
  });

  readonly polylinePoints = computed(() =>
    this.points().map(p => `${p.x},${p.y}`).join(' ')
  );

  readonly xLabels = computed(() => {
    const pts = this.points();
    if (pts.length <= 6) return pts;
    const step = Math.ceil(pts.length / 6);
    return pts.filter((_, i) => i % step === 0 || i === pts.length - 1);
  });

  readonly yGridLines = computed(() => {
    const d = this.data();
    if (!d || d.length === 0) return [];
    const yk = this.yKey();
    const values = d.map(item => Number(item[yk]) || 0);
    const yMin = Math.min(...values);
    const yMax = Math.max(...values);
    const plotH = this.height - this.padding.top - this.padding.bottom;
    const mid = (yMin + yMax) / 2;
    return [
      { value: yMax, y: this.padding.top, label: this.formatNumber(yMax) },
      { value: mid, y: this.padding.top + plotH / 2, label: this.formatNumber(mid) },
      { value: yMin, y: this.padding.top + plotH, label: this.formatNumber(yMin) },
    ];
  });

  private formatNumber(n: number): string {
    if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
    return n.toFixed(0);
  }
}
