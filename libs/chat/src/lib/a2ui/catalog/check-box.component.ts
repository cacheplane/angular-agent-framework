// SPDX-License-Identifier: MIT
import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import type { Spec } from '@json-render/core';
import { emitBinding } from './emit-binding';

@Component({
  selector: 'a2ui-check-box',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="a2ui-cb">
      <input type="checkbox" [checked]="checked()" (change)="onChange($event)" class="a2ui-cb__input" />
      {{ label() }}
    </label>
  `,
  styles: [`
    .a2ui-cb {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      cursor: pointer;
    }
    .a2ui-cb__input {
      width: 16px;
      height: 16px;
      border-radius: 4px;
      cursor: pointer;
      accent-color: var(--a2ui-primary, #2563eb);
    }
  `],
})
export class A2uiCheckBoxComponent {
  readonly label = input<string>('');
  readonly checked = input<boolean>(false);
  readonly _bindings = input<Record<string, string>>({});
  readonly emit = input<(event: string) => void>(() => { /* noop */ });
  // Framework inputs required by the render harness.
  readonly bindings = input<Record<string, string>>({});
  readonly loading = input<boolean>(false);
  readonly childKeys = input<string[]>([]);
  readonly spec = input<Spec | undefined>(undefined);

  onChange(event: Event): void {
    const val = (event.target as HTMLInputElement).checked;
    emitBinding(this.emit(), this._bindings(), 'checked', val);
  }
}
