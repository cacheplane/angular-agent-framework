// SPDX-License-Identifier: MIT
import { Component } from '@angular/core';
import { ChatComponent, ChatTimelineSliderComponent } from '@cacheplane/chat';
import { ExampleChatLayoutComponent } from '@cacheplane/example-layouts';
import { agent, toAgent } from '@cacheplane/langgraph';
import { environment } from '../environments/environment';

/**
 * TimelineComponent demonstrates conversation timeline navigation
 * with ChatComponent and ChatTimelineSliderComponent for scrubbing
 * through conversation checkpoints.
 */
@Component({
  selector: 'app-timeline',
  standalone: true,
  imports: [ChatComponent, ChatTimelineSliderComponent, ExampleChatLayoutComponent],
  template: `
    <example-chat-layout sidebarWidth="w-80">
      <chat main [agent]="chatAgent" class="flex-1 min-w-0" />
      <div sidebar class="p-4 space-y-4" style="background: var(--chat-bg, #171717); color: var(--chat-text, #e0e0e0);">
        <h3 class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--chat-text-muted, #777);">Timeline</h3>
        <chat-timeline-slider [agent]="chatAgent" />
        <div class="mt-4">
          <h4 class="text-xs font-semibold uppercase tracking-wide mb-2"
              style="color: var(--chat-text-muted, #777);">How It Works</h4>
          <p class="text-xs" style="color: var(--chat-text-muted, #777);">
            Each message creates a checkpoint. Use the slider to navigate
            through conversation history and branch from any point.
          </p>
        </div>
      </div>
    </example-chat-layout>
  `,
})
export class TimelineComponent {
  protected readonly stream = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });
  protected readonly chatAgent = toAgent(this.stream);
}
