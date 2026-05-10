// SPDX-License-Identifier: MIT
import { Component, computed, input, ChangeDetectionStrategy } from '@angular/core';
import { emitBinding } from './emit-binding';

/** Resolved option shape — label and value are plain strings after surface-to-spec resolves them. */
interface ResolvedOption {
  label: string;
  value: string;
}

@Component({
  selector: 'a2ui-multiple-choice',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-1">
      @if (label()) {
        <label class="text-xs" style="color: var(--a2ui-label, rgba(255,255,255,0.6));">{{ label() }}</label>
      }

      @if (isSingleSelect()) {
        <!-- Single-select: HTML <select> -->
        <select
          class="rounded-lg px-3 py-2 text-sm"
          [style.background]="'var(--a2ui-input-bg, rgba(255,255,255,0.05))'"
          [style.color]="'var(--a2ui-input-text, white)'"
          [style.border]="'1px solid var(--a2ui-border, rgba(255,255,255,0.1))'"
          (change)="onSelectChange($event)"
        >
          @for (opt of options(); track opt.value) {
            <option [value]="opt.value" [selected]="isSelected(opt.value)">{{ opt.label }}</option>
          }
        </select>
      } @else {
        <!-- Multi-select: checkbox list -->
        <div class="flex flex-col gap-2">
          @for (opt of options(); track opt.value) {
            <label class="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                [checked]="isSelected(opt.value)"
                (change)="onCheckChange(opt.value, $event)"
                class="rounded"
              />
              {{ opt.label }}
            </label>
          }
        </div>
      }
    </div>
  `,
})
export class A2uiMultipleChoiceComponent {
  readonly label = input<string>('');
  /** Resolved current selections (plain string array from surface-to-spec). */
  readonly selections = input<string[]>([]);
  /** Resolved options with plain string labels (surface-to-spec resolves DynamicString). */
  readonly options = input<ResolvedOption[]>([]);
  /** When ≤ 1 — render as single-select <select>; otherwise multi-select checkboxes. */
  readonly maxAllowedSelections = input<number>(1);
  readonly _bindings = input<Record<string, string>>({});
  readonly emit = input<(event: string) => void>(() => { /* noop */ });

  protected readonly isSingleSelect = computed(() => this.maxAllowedSelections() <= 1);

  protected isSelected(value: string): boolean {
    return this.selections().includes(value);
  }

  onSelectChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    emitBinding(this.emit(), this._bindings(), 'selections', val);
  }

  onCheckChange(value: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const current = [...this.selections()];
    const idx = current.indexOf(value);
    if (checked && idx === -1) {
      current.push(value);
    } else if (!checked && idx !== -1) {
      current.splice(idx, 1);
    }
    // Emit the updated selections array as a JSON string so emitBinding can convey it.
    emitBinding(this.emit(), this._bindings(), 'selections', JSON.stringify(current));
  }
}
