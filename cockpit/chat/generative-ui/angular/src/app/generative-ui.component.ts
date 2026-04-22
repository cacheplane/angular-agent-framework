// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component } from '@angular/core';
import { ChatComponent, views } from '@cacheplane/chat';
import { agent, toChatAgent } from '@cacheplane/langgraph';
import { ExampleChatLayoutComponent } from '@cacheplane/example-layouts';
import { environment } from '../environments/environment';

import { StatCardComponent } from './views/stat-card.component';
import { ContainerComponent } from './views/container.component';
import { DashboardGridComponent } from './views/dashboard-grid.component';
import { LineChartComponent } from './views/line-chart.component';
import { BarChartComponent } from './views/bar-chart.component';
import { DataGridComponent } from './views/data-grid.component';

const dashboardViews = views({
  stat_card: StatCardComponent,
  container: ContainerComponent,
  dashboard_grid: DashboardGridComponent,
  line_chart: LineChartComponent,
  bar_chart: BarChartComponent,
  data_grid: DataGridComponent,
});

@Component({
  selector: 'app-generative-ui',
  standalone: true,
  imports: [ChatComponent, ExampleChatLayoutComponent],
  template: `
    <example-chat-layout>
      <chat main [agent]="chatAgent" [views]="dashboardViews" class="flex-1 min-w-0" />
    </example-chat-layout>
  `,
})
export class GenerativeUiComponent {
  protected readonly agentRef = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.generativeUiAssistantId,
  });
  protected readonly chatAgent = toChatAgent(this.agentRef);
  protected readonly dashboardViews = dashboardViews;
}
