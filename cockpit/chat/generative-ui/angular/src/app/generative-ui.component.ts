// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component } from '@angular/core';
import { ChatComponent, views } from '@cacheplane/chat';
import { agent } from '@cacheplane/angular';
import { ExampleChatLayoutComponent } from '@cacheplane/example-layouts';
import { environment } from '../environments/environment';
import { WeatherCardComponent } from './views/weather-card.component';
import { StatCardComponent } from './views/stat-card.component';
import { ContainerComponent } from './views/container.component';

const myViews = views({
  weather_card: WeatherCardComponent,
  stat_card: StatCardComponent,
  container: ContainerComponent,
});

@Component({
  selector: 'app-generative-ui',
  standalone: true,
  imports: [ChatComponent, ExampleChatLayoutComponent],
  template: `
    <example-chat-layout>
      <chat main [ref]="agentRef" [views]="myViews" class="flex-1 min-w-0" />
    </example-chat-layout>
  `,
})
export class GenerativeUiComponent {
  protected readonly agentRef = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.generativeUiAssistantId,
  });
  protected readonly myViews = myViews;
}
