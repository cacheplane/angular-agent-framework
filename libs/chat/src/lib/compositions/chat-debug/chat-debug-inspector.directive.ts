// SPDX-License-Identifier: MIT
import { Directive, TemplateRef, inject, input } from '@angular/core';

/**
 * Marks an `<ng-template>` as a host-registered inspector tab. Each instance
 * adds a tab in the docked panel's tab strip, appended after the built-in
 * Timeline and State tabs.
 */
@Directive({
  selector: 'ng-template[chatDebugInspector]',
  standalone: true,
})
export class ChatDebugInspectorDirective {
  readonly label = input.required<string>();
  readonly templateRef = inject(TemplateRef);
}
