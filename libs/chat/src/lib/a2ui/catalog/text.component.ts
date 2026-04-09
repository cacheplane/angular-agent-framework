// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, input } from '@angular/core';

@Component({
  selector: 'a2ui-text',
  standalone: true,
  template: `<span [class]="'text-sm text-current'">{{ text() }}</span>`,
})
export class A2uiTextComponent {
  readonly text = input<string>('');
}
