// SPDX-License-Identifier: MIT
import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-data-grid',
  standalone: true,
  template: `
    <div class="rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
      <div class="text-sm font-medium text-white/60 mb-3">{{ title() }}</div>
      @if (isSkeleton()) {
        @for (i of skeletonRows; track i) {
          <div class="skeleton skeleton-row"></div>
        }
      } @else {
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-white/10">
              @for (col of formattedColumns(); track col.key) {
                <th class="text-left text-xs font-medium uppercase tracking-wider text-white/40 py-2 px-2">{{ col.label }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track $index) {
              <tr class="border-b border-white/5" [class.bg-white/5]="$index % 2 === 1">
                @for (col of formattedColumns(); track col.key) {
                  <td class="py-2 px-2 text-white/80">{{ row[col.key] }}</td>
                }
              </tr>
            }
          </tbody>
        </table>
      }
    </div>
  `,
  styleUrls: ['./skeleton.css'],
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
