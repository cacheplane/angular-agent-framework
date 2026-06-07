// SPDX-License-Identifier: MIT
import { Component } from '@angular/core';
import { ChatComponent, views } from '@threadplane/chat';
import { injectAgent } from '@threadplane/ag-ui';
import { ExampleChatLayoutComponent } from '@threadplane/example-layouts';
import { StatCardComponent } from './views/stat-card.component';

const dashboardViews = views({ stat_card: StatCardComponent });

@Component({
  selector: 'app-json-render',
  standalone: true,
  imports: [ChatComponent, ExampleChatLayoutComponent],
  template: `
    <example-chat-layout>
      <chat main [agent]="agent" [views]="dashboardViews" class="flex-1 min-w-0" />
    </example-chat-layout>
  `,
})
export class JsonRenderComponent {
  protected readonly agent = injectAgent();
  protected readonly dashboardViews = dashboardViews;
}
