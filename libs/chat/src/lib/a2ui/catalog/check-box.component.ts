// SPDX-License-Identifier: MIT
import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import type { Spec } from '@json-render/core';
import { emitBinding } from './emit-binding';

@Component({
  selector: 'a2ui-check-box',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="flex items-center gap-2 text-sm cursor-pointer">
      <input type="checkbox" [checked]="checked()" (change)="onChange($event)" class="rounded" />
      {{ label() }}
    </label>
  `,
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
