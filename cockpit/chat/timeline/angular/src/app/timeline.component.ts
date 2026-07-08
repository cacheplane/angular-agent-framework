// SPDX-License-Identifier: MIT
import { Component } from '@angular/core';
import { ChatComponent, ChatTimelineSliderComponent } from '@threadplane/chat';
import { ExampleChatLayoutComponent } from '@threadplane/example-layouts';
import { injectAgent } from '@threadplane/langgraph';

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
    <example-chat-layout sidebarWidth="20rem">
      <chat main [agent]="agent" class="flex-1 min-w-0" />
      <div sidebar class="panel">
        <h3 class="cap">Timeline</h3>
        <chat-timeline-slider [agent]="agent" />
        <div>
          <h4 class="cap">How It Works</h4>
          <p class="info">
            Each message creates a checkpoint. Use the slider to navigate
            through conversation history and branch from any point.
          </p>
        </div>
      </div>
    </example-chat-layout>
  `,
  styles: [`
    .panel {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 1rem;
      background: var(--tplane-chat-bg);
      color: var(--tplane-chat-text);
    }

    .cap {
      margin: 0;
      color: var(--tplane-chat-text-muted);
      font-size: var(--tplane-chat-font-size-xs);
      font-weight: 700;
      letter-spacing: 0.12em;
      line-height: var(--tplane-chat-line-height-tight);
      text-transform: uppercase;
    }

    .info {
      margin: 0.5rem 0 0;
      color: var(--tplane-chat-text-muted);
      font-size: var(--tplane-chat-font-size-sm);
      line-height: var(--tplane-chat-line-height);
    }
  `],
})
export class TimelineComponent {
  protected readonly agent = injectAgent();
}
