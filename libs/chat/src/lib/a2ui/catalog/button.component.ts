// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, input } from '@angular/core';
import type { A2uiCheck } from '@cacheplane/a2ui';
import { validateChecks } from '@cacheplane/a2ui';

@Component({
  selector: 'a2ui-button',
  standalone: true,
  template: `
    <button
      class="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
      [class]="variant() === 'borderless' ? 'bg-transparent hover:bg-white/10' : 'bg-blue-600 hover:bg-blue-700 text-white'"
      [disabled]="disabled() || !isValid()"
      (click)="handleClick()"
    >{{ label() }}</button>
  `,
})
export class A2uiButtonComponent {
  readonly label = input<string>('');
  readonly variant = input<string>('primary');
  readonly disabled = input<boolean>(false);
  readonly checks = input<A2uiCheck[]>([]);
  readonly emit = input<(event: string) => void>(() => { /* noop */ });

  isValid(): boolean {
    const c = this.checks();
    if (!c || c.length === 0) return true;
    return validateChecks(c).valid;
  }

  handleClick(): void {
    this.emit()('click');
  }
}
