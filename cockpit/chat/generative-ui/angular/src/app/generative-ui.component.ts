// SPDX-License-Identifier: MIT
import { Component } from '@angular/core';
import { ChatComponent, views } from '@ngaf/chat';
import { agent } from '@ngaf/langgraph';
import { ExampleChatLayoutComponent } from '@ngaf/example-layouts';
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
      <chat main [agent]="agent" [views]="dashboardViews" class="flex-1 min-w-0" />
    </example-chat-layout>
  `,
})
export class GenerativeUiComponent {
  protected readonly agent = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.generativeUiAssistantId,
  });
  protected readonly dashboardViews = dashboardViews;
}
