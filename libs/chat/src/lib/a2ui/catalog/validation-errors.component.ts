// SPDX-License-Identifier: MIT
import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import type { A2uiValidationResult } from '@cacheplane/a2ui';

@Component({
  selector: 'a2ui-validation-errors',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!result().valid) {
      @for (error of result().errors; track error) {
        <p class="text-xs mt-1" style="color: var(--a2ui-error, #ef4444);">{{ error }}</p>
      }
    }
  `,
})
export class A2uiValidationErrorsComponent {
  readonly result = input<A2uiValidationResult>({ valid: true, errors: [] });
}
