import { Component } from '@angular/core';
import { ChatComponent } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

/**
 * SkillsComponent demonstrates a multi-skill agent with specialized tools.
 *
 * The agent can calculate math expressions, count words, and summarize text
 * by selecting the appropriate skill tool for each user request.
 */
@Component({
  selector: 'app-skills',
  standalone: true,
  imports: [ChatComponent],
  template: `<chat [ref]="stream" class="block h-screen" />`,
})
export class SkillsComponent {
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });
}
