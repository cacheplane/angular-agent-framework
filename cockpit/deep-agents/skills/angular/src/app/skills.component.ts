// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component } from '@angular/core';
import { ChatDebugComponent } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-skills',
  standalone: true,
  imports: [ChatDebugComponent],
  template: `<chat-debug [ref]="stream" class="block h-screen" />`,
})
export class SkillsComponent {
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });
}
