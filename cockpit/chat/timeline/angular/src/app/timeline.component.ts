// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component } from '@angular/core';
import { ChatComponent, ChatTimelineSliderComponent } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

/**
 * TimelineComponent demonstrates conversation timeline navigation
 * with ChatComponent and ChatTimelineSliderComponent for scrubbing
 * through conversation checkpoints.
 */
@Component({
  selector: 'app-timeline',
  standalone: true,
  imports: [ChatComponent, ChatTimelineSliderComponent],
  template: `
    <div class="flex h-screen">
      <chat [ref]="stream" class="flex-1 min-w-0" />
      <aside class="w-80 shrink-0 border-l overflow-y-auto p-4 space-y-4"
             style="border-color: var(--chat-border, #333); background: var(--chat-bg, #171717); color: var(--chat-text, #e0e0e0);">
        <h3 class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--chat-text-muted, #777);">Timeline</h3>
        <chat-timeline-slider [ref]="stream" />
        <div class="mt-4">
          <h4 class="text-xs font-semibold uppercase tracking-wide mb-2"
              style="color: var(--chat-text-muted, #777);">How It Works</h4>
          <p class="text-xs" style="color: var(--chat-text-muted, #777);">
            Each message creates a checkpoint. Use the slider to navigate
            through conversation history and branch from any point.
          </p>
        </div>
      </aside>
    </div>
  `,
})
export class TimelineComponent {
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });
}
