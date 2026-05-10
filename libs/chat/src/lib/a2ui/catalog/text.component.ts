// SPDX-License-Identifier: MIT
import { Component, input } from '@angular/core';
import type { Spec } from '@json-render/core';

type UsageHint = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'caption' | 'body';

@Component({
  selector: 'a2ui-text',
  standalone: true,
  template: `<span [class]="cssClass()">{{ text() }}</span>`,
  styles: [`
    .a2ui-text-h1 {
      display: block;
      font-size: 2rem;
      font-weight: 700;
      line-height: 1.2;
      margin: 0;
    }
    .a2ui-text-h2 {
      display: block;
      font-size: 1.5rem;
      font-weight: 600;
      line-height: 1.3;
      margin: 0;
    }
    .a2ui-text-h3 {
      display: block;
      font-size: 1.25rem;
      font-weight: 600;
      line-height: 1.4;
      margin: 0;
    }
    .a2ui-text-h4 {
      display: block;
      font-size: 1.125rem;
      font-weight: 500;
      line-height: 1.4;
      margin: 0;
    }
    .a2ui-text-h5 {
      display: block;
      font-size: 1rem;
      font-weight: 500;
      line-height: 1.5;
      margin: 0;
    }
    .a2ui-text-caption {
      display: block;
      font-size: 0.75rem;
      color: var(--a2ui-caption, rgba(255,255,255,0.5));
      line-height: 1.4;
    }
    .a2ui-text-body {
      display: block;
      font-size: 0.875rem;
      line-height: 1.6;
    }
  `],
})
export class A2uiTextComponent {
  readonly text = input<string>('');
  readonly usageHint = input<UsageHint>('body');
  // Framework-mandated inputs the render harness passes to every element.
  readonly bindings = input<Record<string, string>>({});
  readonly emit = input<(event: string) => void>(() => { /* noop */ });
  readonly loading = input<boolean>(false);
  readonly childKeys = input<string[]>([]);
  readonly spec = input<Spec | undefined>(undefined);

  protected cssClass(): string {
    return `a2ui-text-${this.usageHint()}`;
  }
}
