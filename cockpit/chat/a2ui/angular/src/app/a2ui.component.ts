// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component } from '@angular/core';
import { ChatComponent, a2uiBasicCatalog } from '@cacheplane/chat';
import { agent } from '@cacheplane/angular';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-a2ui',
  standalone: true,
  imports: [ChatComponent],
  template: `<chat [ref]="agentRef" [views]="catalog" class="block h-screen" />`,
})
export class A2uiComponent {
  protected readonly agentRef = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.a2uiAssistantId,
  });
  protected readonly catalog = a2uiBasicCatalog();
}
