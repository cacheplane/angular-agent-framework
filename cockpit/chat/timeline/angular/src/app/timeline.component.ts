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
      <div sidebar class="p-4 space-y-4" style="background: var(--tplane-chat-bg); color: var(--tplane-chat-text);">
        <h3 class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--tplane-chat-text-muted);">Timeline</h3>
        <chat-timeline-slider [agent]="agent" />
        <div class="mt-4">
          <h4 class="text-xs font-semibold uppercase tracking-wide mb-2"
              style="color: var(--tplane-chat-text-muted);">How It Works</h4>
          <p class="text-xs" style="color: var(--tplane-chat-text-muted);">
            Each message creates a checkpoint. Use the slider to navigate
            through conversation history and branch from any point.
          </p>
        </div>
      </div>
    </example-chat-layout>
  `,
})
export class TimelineComponent {
  protected readonly agent = injectAgent();
}
