import { Component, input } from '@angular/core';

@Component({
  selector: 'plan-checklist',
  standalone: true,
  template: `
    <div class="border rounded-xl p-4 my-2" style="border-color: var(--chat-border); background: var(--chat-bg-alt);">
      <h4 class="text-sm font-semibold mb-2" style="color: var(--chat-text);">{{ title() }}</h4>
      <ng-content />
    </div>
  `,
})
export class PlanChecklistComponent {
  readonly title = input<string>('Plan');
}
