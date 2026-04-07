import { Component } from '@angular/core';
import { ChatComponent, views } from '@cacheplane/chat';
import { signalStateStore } from '@cacheplane/render';
import { agent } from '@cacheplane/angular';
import { environment } from '../environments/environment';
import { PlanChecklistComponent } from './views/plan-checklist.component';
import { CheckboxRowComponent } from './views/checkbox-row.component';

@Component({
  selector: 'app-planning',
  standalone: true,
  imports: [ChatComponent],
  template: `<chat [ref]="stream" [views]="ui" [store]="uiStore" class="block h-screen" />`,
})
export class PlanningComponent {
  protected readonly stream = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.planningAssistantId,
  });

  readonly ui = views({
    'plan-checklist': PlanChecklistComponent,
    'checkbox-row': CheckboxRowComponent,
  });

  readonly uiStore = signalStateStore({});
}
