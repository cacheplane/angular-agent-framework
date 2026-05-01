// SPDX-License-Identifier: MIT
import { Directive, input, TemplateRef, inject } from '@angular/core';
import type { MessageTemplateType } from '../../chat.types';

@Directive({
  selector: 'ng-template[chatMessageTemplate]',
  standalone: true,
})
export class MessageTemplateDirective {
  readonly chatMessageTemplate = input.required<MessageTemplateType>();
  readonly templateRef = inject(TemplateRef);
}
