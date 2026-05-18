// SPDX-License-Identifier: MIT
import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-data-grid',
  standalone: true,
  template: `
    <div class="data-grid">
      <div class="data-grid__title">{{ title() }}</div>
      @if (isSkeleton()) {
        @for (i of skeletonRows; track i) {
          <div class="skeleton skeleton-row"></div>
        }
      } @else {
        <div class="data-grid__scroll">
          <table class="data-grid__table">
            <thead>
              <tr>
                @for (col of formattedColumns(); track col.key) {
                  <th>{{ col.label }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track $index) {
                <tr>
                  @for (col of formattedColumns(); track col.key) {
                    <td>{{ row[col.key] }}</td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styleUrls: ['./skeleton.css'],
  styles: [`
    .data-grid {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px 18px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.03);
      backdrop-filter: blur(4px);
    }
    .data-grid__title {
      font-size: 13px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.65);
      letter-spacing: 0.01em;
    }
    .data-grid__scroll {
      overflow-x: auto;
      margin: 0 -4px;
    }
    .data-grid__table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      font-variant-numeric: tabular-nums;
    }
    .data-grid__table th {
      text-align: left;
      padding: 8px 10px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.45);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      white-space: nowrap;
    }
    .data-grid__table td {
      padding: 10px;
      color: rgba(255, 255, 255, 0.85);
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      white-space: nowrap;
    }
    .data-grid__table tbody tr:nth-child(even) td {
      background: rgba(255, 255, 255, 0.02);
    }
    .data-grid__table tbody tr:last-child td {
      border-bottom: none;
    }
  `],
})
export class DataGridComponent {
  readonly title = input<string>('');
  readonly rows = input<Record<string, unknown>[] | null>(null);
  readonly columns = input<string[]>([]);

  readonly skeletonRows = [0, 1, 2, 3];

  readonly isSkeleton = computed(() => this.rows() == null);

  readonly formattedColumns = computed(() =>
    this.columns().map(key => ({
      key,
      label: key
        .split('_')
        .map(word =>
          word.length <= 3
            ? word.toUpperCase()
            : word.charAt(0).toUpperCase() + word.slice(1)
        )
        .join(' '),
    }))
  );
}
