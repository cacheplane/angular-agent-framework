// SPDX-License-Identifier: MIT
import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-line-chart',
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
          <!-- Gridlines -->
          @for (y of yGridLines(); track y.value) {
            <line
              [attr.x1]="padding.left"
              [attr.y1]="y.y"
              [attr.x2]="width - padding.right"
              [attr.y2]="y.y"
              stroke="var(--tplane-chat-separator)"
              stroke-width="1"
            />
            <text
              [attr.x]="padding.left - 8"
              [attr.y]="y.y + 4"
              text-anchor="end"
              fill="var(--tplane-chat-text-muted)"
              font-size="11"
            >{{ y.label }}</text>
          }
          <!-- Area fill under the line -->
          <path
            [attr.d]="areaPath()"
            fill="url(#line-area-gradient)"
            stroke="none"
          />
          <!-- Line -->
          <polyline
            [attr.points]="polylinePoints()"
            fill="none"
            stroke="var(--tplane-chat-primary)"
            stroke-width="2"
            stroke-linejoin="round"
            stroke-linecap="round"
          />
          <!-- Data points -->
          @for (pt of points(); track $index) {
            <circle [attr.cx]="pt.x" [attr.cy]="pt.y" r="3" fill="var(--tplane-chat-surface)" stroke="var(--tplane-chat-primary)" stroke-width="2" />
          }
          <!-- X-axis labels -->
          @for (pt of xLabels(); track $index) {
            <text
              [attr.x]="pt.x"
              [attr.y]="height - 6"
              text-anchor="middle"
              fill="var(--tplane-chat-text-muted)"
              font-size="11"
            >{{ pt.label }}</text>
          }
          <defs>
            <linearGradient id="line-area-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--tplane-chat-primary)" stop-opacity="0.28"/>
              <stop offset="100%" stop-color="var(--tplane-chat-primary)" stop-opacity="0"/>
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
      border: 1px solid var(--tplane-chat-separator);
      border-radius: var(--tplane-chat-radius-card);
      background: var(--tplane-chat-surface-alt);
      backdrop-filter: blur(4px);
    }
    .chart-card__title {
      font-size: 13px;
      font-weight: 600;
      color: var(--tplane-chat-text-muted);
      letter-spacing: 0.01em;
    }
    .chart-card__svg {
      width: 100%;
      height: auto;
      max-height: 280px;
      display: block;
    }
  `],
})
export class LineChartComponent {
  readonly title = input<string>('');
  readonly data = input<Record<string, unknown>[] | null>(null);
  readonly xKey = input<string>('');
  readonly yKey = input<string>('');

  readonly width = 400;
  readonly height = 220;
  readonly padding = { top: 16, right: 16, bottom: 28, left: 44 };

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

  readonly areaPath = computed((): string => {
    const pts = this.points();
    if (pts.length === 0) return '';
    const baseline = this.padding.top + (this.height - this.padding.top - this.padding.bottom);
    const top = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    return `${top} L ${pts[pts.length - 1].x} ${baseline} L ${pts[0].x} ${baseline} Z`;
  });

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
