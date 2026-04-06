// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component } from '@angular/core';
import { ChatComponent, ChatTimelineSliderComponent } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-time-travel',
  standalone: true,
  imports: [ChatComponent, ChatTimelineSliderComponent],
  template: `
    <div class="flex h-screen">
      <chat [ref]="stream" class="flex-1 min-w-0" />
      <aside class="w-80 shrink-0 border-l overflow-y-auto"
             style="border-color: var(--chat-border, #333); background: var(--chat-bg, #171717);">
        <div class="p-4">
          <h3 class="text-xs font-semibold uppercase tracking-wide mb-3"
              style="color: var(--chat-text-muted, #777);">Time Travel</h3>
          <chat-timeline-slider
            [ref]="stream"
            (replayRequested)="onReplay($event)"
            (forkRequested)="onFork($event)"
          />
        </div>
      </aside>
    </div>
  `,
})
export class TimeTravelComponent {
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  protected onReplay(checkpointId: string): void {
    this.stream.setBranch(checkpointId);
  }

  protected onFork(checkpointId: string): void {
    this.stream.setBranch(checkpointId);
    // Fork: set branch, then next submit creates a new branch from this point
  }
}
