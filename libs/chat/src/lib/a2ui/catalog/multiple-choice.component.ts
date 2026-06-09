// SPDX-License-Identifier: MIT
import { Component, computed, input, ChangeDetectionStrategy } from '@angular/core';
import type { Spec } from '@json-render/core';
import { injectRenderHost } from '@threadplane/render';
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
    .a2ui-mc { display: flex; flex-direction: column; gap: var(--a2ui-spacing-1); }
    .a2ui-mc__label {
      font-size: var(--a2ui-typography-label-size);
      font-weight: var(--a2ui-typography-label-weight);
      color: var(--a2ui-label);
    }
    .a2ui-mc__select {
      padding: var(--a2ui-spacing-2) var(--a2ui-spacing-3);
      font-size: var(--a2ui-typography-body-size);
      border-radius: var(--a2ui-shape-small);
      background: var(--a2ui-input-bg);
      color: var(--a2ui-on-surface);
      border: 1px solid var(--a2ui-outline);
      outline: none;
      transition: border-color var(--a2ui-motion-duration-short) var(--a2ui-motion-easing-standard);
    }
    .a2ui-mc__select:focus {
      outline: var(--a2ui-focus-ring-width) solid var(--a2ui-focus-ring-color);
      outline-offset: 2px;
      border-color: var(--a2ui-primary);
    }
    .a2ui-mc__checks { display: flex; flex-direction: column; gap: var(--a2ui-spacing-2); }
    .a2ui-mc__check-row {
      display: flex;
      align-items: center;
      gap: var(--a2ui-spacing-2);
      font-size: var(--a2ui-typography-body-size);
      cursor: pointer;
    }
    .a2ui-mc__checkbox {
      width: 16px;
      height: 16px;
      border-radius: var(--a2ui-shape-extra-small);
      cursor: pointer;
      accent-color: var(--a2ui-primary);
    }
  `],
})
export class A2uiMultipleChoiceComponent {
  private readonly host = injectRenderHost();

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
    emitBinding(this.host, this._bindings(), 'selections', val);
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
    // Pass the updated selections array directly (typed value, no JSON stringification needed).
    emitBinding(this.host, this._bindings(), 'selections', current);
  }
}
