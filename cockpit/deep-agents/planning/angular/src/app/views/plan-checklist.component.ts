import { Component, input } from '@angular/core';

@Component({
  selector: 'plan-checklist',
  standalone: true,
  template: `
    <div class="checklist">
      <h4 class="checklist__title">{{ title() }}</h4>
      <ng-content />
    </div>
  `,
  styles: [`
    .checklist {
      margin: 0.5rem 0;
      padding: 1rem;
      border: 1px solid var(--tplane-chat-separator);
      border-radius: var(--tplane-chat-radius-card);
      background: var(--tplane-chat-surface-alt);
    }

    .checklist__title {
      margin: 0 0 0.5rem;
      color: var(--tplane-chat-text);
      font-size: var(--tplane-chat-font-size-sm);
      font-weight: 700;
    }
  `],
})
export class PlanChecklistComponent {
  readonly title = input<string>('Plan');
}
