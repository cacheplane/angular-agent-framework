// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
/**
 * TimeTravelComponent demonstrates LangGraph's checkpoint and time-travel API.
 *
 * Every time the agent sends a response, LangGraph saves a checkpoint — a
 * snapshot of the full conversation state at that moment. Time travel lets
 * you jump back to any checkpoint and continue from there.
 *
 * Two modes are exposed:
 * - **Replay**: re-runs the graph from the selected checkpoint with the same
 *   input, producing the same (or a different, if non-deterministic) output.
 * - **Fork**: sets the active branch to the checkpoint so the *next* submit()
 *   starts a new conversation branch diverging from that point.
 *
 * Both modes call `stream.setBranch(checkpointId)` under the hood; the
 * difference is only conceptual and reflected in how the user interacts next.
 */
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

  /**
   * Replay: sets the branch to replay from this checkpoint.
   * The graph re-runs from this point with the same input.
   */
  protected onReplay(checkpointId: string): void {
    this.stream.setBranch(checkpointId);
  }

  /**
   * Fork: sets the branch, then the next submit() creates a new
   * conversation branch diverging from this checkpoint.
   */
  protected onFork(checkpointId: string): void {
    this.stream.setBranch(checkpointId);
  }
}
