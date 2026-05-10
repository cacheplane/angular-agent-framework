// SPDX-License-Identifier: MIT
import { Component, input } from '@angular/core';

type UsageHint = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'caption' | 'body';

const HINT_CLASS: Record<UsageHint, string> = {
  h1: 'text-3xl font-bold',
  h2: 'text-2xl font-semibold',
  h3: 'text-xl font-semibold',
  h4: 'text-lg font-medium',
  h5: 'text-base font-medium',
  caption: 'text-xs text-white/50',
  body: 'text-sm text-current',
};

@Component({
  selector: 'a2ui-text',
  standalone: true,
  template: `<span [class]="cssClass()">{{ text() }}</span>`,
})
export class A2uiTextComponent {
  readonly text = input<string>('');
  readonly usageHint = input<UsageHint>('body');

  protected cssClass(): string {
    return HINT_CLASS[this.usageHint()] ?? HINT_CLASS.body;
  }
}
