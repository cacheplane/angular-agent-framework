// SPDX-License-Identifier: MIT
import { Component, computed, input, ChangeDetectionStrategy } from '@angular/core';
import type { Spec } from '@json-render/core';
import { injectRenderHost } from '@threadplane/render';
import { emitBinding } from './emit-binding';

@Component({
  selector: 'a2ui-check-box',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="a2ui-cb">
      <input type="checkbox" [checked]="effectiveValue()" (change)="onChange($event)" class="a2ui-cb__input" />
      {{ label() }}
    </label>
  `,
  styles: [`
    .a2ui-cb {
      display: flex;
      align-items: center;
      gap: var(--a2ui-spacing-2);
      font-size: var(--a2ui-typography-body-size);
      cursor: pointer;
    }
    .a2ui-cb__input {
      width: 16px;
      height: 16px;
      border-radius: var(--a2ui-shape-extra-small);
      cursor: pointer;
      accent-color: var(--a2ui-primary);
    }
  `],
})
export class A2uiCheckBoxComponent {
  private readonly host = injectRenderHost();

  readonly label = input<string>('');
  /** v1 canonical prop: boolean checked state. */
  readonly value = input<boolean | undefined>(undefined);
  /** Pre-v1 alias retained for back-compat. */
  readonly checked = input<boolean>(false);
  readonly _bindings = input<Record<string, string>>({});
  // Framework inputs required by the render harness.
  readonly bindings = input<Record<string, string>>({});
  readonly loading = input<boolean>(false);
  readonly childKeys = input<string[]>([]);
  readonly spec = input<Spec | undefined>(undefined);

  protected readonly effectiveValue = computed(() => this.value() ?? this.checked());

  onChange(event: Event): void {
    const val = (event.target as HTMLInputElement).checked;
    // Emit on whichever binding the surface declared. v1 surfaces use
    // `value`; pre-v1 used `checked`.
    const bound = this._bindings();
    if (bound['value']) {
      emitBinding(this.host, bound, 'value', val);
    } else {
      emitBinding(this.host, bound, 'checked', val);
    }
  }
}
