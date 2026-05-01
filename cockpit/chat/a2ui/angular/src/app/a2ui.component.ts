// SPDX-License-Identifier: MIT
import { Component } from '@angular/core';
import { ChatComponent, a2uiBasicCatalog } from '@ngaf/chat';
import { agent } from '@ngaf/langgraph';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-a2ui',
  standalone: true,
  imports: [ChatComponent],
  template: `<chat [agent]="agent" [views]="catalog" class="block h-screen" />`,
})
export class A2uiComponent {
  protected readonly agent = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.a2uiAssistantId,
  });
  protected readonly catalog = a2uiBasicCatalog();
}
