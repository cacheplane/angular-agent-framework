// SPDX-License-Identifier: MIT
import { Component } from '@angular/core';
import { ChatComponent, a2uiBasicCatalog } from '@ngaf/chat';
import { ExampleChatLayoutComponent } from '@ngaf/example-layouts';
import { agent } from '@ngaf/langgraph';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-a2ui',
  standalone: true,
  imports: [ChatComponent, ExampleChatLayoutComponent],
  template: `
    <example-chat-layout>
      <chat main [agent]="agent" [views]="catalog" class="flex-1 min-w-0" />
    </example-chat-layout>
  `,
})
export class A2uiComponent {
  protected readonly agent = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.a2uiAssistantId,
  });
  protected readonly catalog = a2uiBasicCatalog();
}
