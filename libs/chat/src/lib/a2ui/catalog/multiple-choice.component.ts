// SPDX-License-Identifier: MIT
import { Component, computed, input, ChangeDetectionStrategy } from '@angular/core';
import type { Spec } from '@json-render/core';
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
    <div class="a2ui-mc">
      @if (label()) {
        <span class="a2ui-mc__label">{{ label() }}</span>
      }

      @if (isSingleSelect()) {
        <!-- Single-select: HTML <select> -->
        <select class="a2ui-mc__select" (change)="onSelectChange($event)">
          @for (opt of options(); track opt.value) {
            <option [value]="opt.value" [selected]="isSelected(opt.value)">{{ opt.label }}</option>
          }
        </select>
      } @else {
        <!-- Multi-select: checkbox list -->
        <div class="a2ui-mc__checks">
          @for (opt of options(); track opt.value) {
            <label class="a2ui-mc__check-row">
              <input
                type="checkbox"
                class="a2ui-mc__checkbox"
                [checked]="isSelected(opt.value)"
                (change)="onCheckChange(opt.value, $event)"
              />
              {{ opt.label }}
            </label>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .a2ui-mc { display: flex; flex-direction: column; gap: 4px; }
    .a2ui-mc__label { font-size: 12px; color: var(--a2ui-label, rgba(255,255,255,0.6)); }
    .a2ui-mc__select {
      padding: 8px 12px;
      font-size: 14px;
      border-radius: 8px;
      background: var(--a2ui-input-bg, rgba(255,255,255,0.05));
      color: var(--a2ui-input-text, white);
      border: 1px solid var(--a2ui-border, rgba(255,255,255,0.1));
      outline: none;
      transition: border-color 120ms;
    }
    .a2ui-mc__select:focus { border-color: var(--a2ui-primary, #4f8df5); }
    .a2ui-mc__checks { display: flex; flex-direction: column; gap: 8px; }
    .a2ui-mc__check-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      cursor: pointer;
    }
    .a2ui-mc__checkbox {
      width: 16px;
      height: 16px;
      border-radius: 4px;
      cursor: pointer;
      accent-color: var(--a2ui-primary, #2563eb);
    }
  `],
})
export class A2uiMultipleChoiceComponent {
  readonly label = input<string>('');
  /** Resolved current selections from surface-to-spec. Normalized in
   * `selectionsArray` because LLMs sometimes seed the data model with a
   * scalar (e.g. `"5"`) instead of an array (`["5"]`); we coerce so
   * .includes() works either way. */
  readonly selections = input<string | string[] | undefined>(undefined);

  protected readonly selectionsArray = computed<string[]>(() => {
    const v = this.selections();
    if (Array.isArray(v)) return v;
    if (v == null || v === '') return [];
    return [String(v)];
  });
  /** Resolved options with plain string labels (surface-to-spec resolves DynamicString). */
  readonly options = input<ResolvedOption[]>([]);
  /** When ≤ 1 — render as single-select <select>; otherwise multi-select checkboxes. */
  readonly maxAllowedSelections = input<number>(1);
  readonly _bindings = input<Record<string, string>>({});
  readonly emit = input<(event: string) => void>(() => { /* noop */ });
  // Framework inputs required by the render harness.
  readonly bindings = input<Record<string, string>>({});
  readonly loading = input<boolean>(false);
  readonly childKeys = input<string[]>([]);
  readonly spec = input<Spec | undefined>(undefined);

  protected readonly isSingleSelect = computed(() => this.maxAllowedSelections() <= 1);

  protected isSelected(value: string): boolean {
    return this.selectionsArray().includes(value);
  }

  onSelectChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    emitBinding(this.emit(), this._bindings(), 'selections', val);
  }

  onCheckChange(value: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const current = [...this.selectionsArray()];
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
