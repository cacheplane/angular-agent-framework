// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component } from '@angular/core';
import { ChatComponent, a2uiBasicCatalog } from '@cacheplane/chat';
import { agent, toChatAgent } from '@cacheplane/langgraph';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-a2ui',
  standalone: true,
  imports: [ChatComponent],
  template: `<chat [agent]="chatAgent" [views]="catalog" class="block h-screen" />`,
})
export class A2uiComponent {
  protected readonly agentRef = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.a2uiAssistantId,
  });
  protected readonly chatAgent = toChatAgent(this.agentRef);
  protected readonly catalog = a2uiBasicCatalog();
}
