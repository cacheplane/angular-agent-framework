// SPDX-License-Identifier: MIT
import { Directive, TemplateRef, inject } from '@angular/core';

/**
 * Marks an `<ng-template>` as the controls slot of `<chat-debug>`. Rendered
 * pinned at the top of the docked panel. Host apps put their app-specific
 * controls (mode picker, model select, etc.) inside this template.
 */
@Directive({
  selector: 'ng-template[chatDebugControls]',
  standalone: true,
})
export class ChatDebugControlsDirective {
  readonly templateRef = inject(TemplateRef);
}
