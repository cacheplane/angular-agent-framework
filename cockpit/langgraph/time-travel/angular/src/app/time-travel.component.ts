import { Component, computed, signal } from '@angular/core';
import { ChatComponent } from '@ngaf/chat';
import { agent } from '@ngaf/langgraph';
import type { ThreadState } from '@ngaf/langgraph';
import { ExampleChatLayoutComponent } from '@ngaf/example-layouts';
import { environment } from '../environments/environment';

/**
 * TimeTravelComponent demonstrates replaying and branching conversation history.
 *
 * Layout: chat panel (flex-1) + checkpoint timeline sidebar (w-72).
 *
 * Key integration points:
 * - `stream.history()` -- array of ThreadState snapshots
 * - `stream.branch()` -- current branch identifier
 * - `stream.setBranch(id)` -- switch to a different checkpoint
 */
@Component({
  selector: 'app-time-travel',
  standalone: true,
  imports: [ChatComponent, ExampleChatLayoutComponent],
  template: `
    <example-chat-layout>
      <!-- Chat panel -->
      <chat main [agent]="agent" class="block flex-1" />

      <!-- Checkpoint timeline sidebar -->
      <div sidebar
        class="flex flex-col overflow-hidden"
        style="background: var(--chat-bg, #171717); color: var(--chat-text, #e0e0e0);"
      >
        <div class="px-4 py-3 border-b border-[var(--chat-border)]">
          <h2 class="text-sm font-semibold text-[var(--chat-text)] uppercase tracking-wide">
            Timeline
          </h2>
          <p class="text-xs text-[var(--chat-text-muted)] mt-0.5">
            {{ checkpoints().length }} checkpoint(s)
          </p>
        </div>

        <div class="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
          @if (checkpoints().length === 0) {
            <p class="text-xs text-[var(--chat-text-muted)] text-center py-6">
              No checkpoints yet. Send a message to begin.
            </p>
          }

          @for (state of checkpoints(); track $index; let i = $index) {
            <div
              class="flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors"
              [class]="
                i === selectedIndex()
                  ? 'border-[var(--chat-input-focus-border)] bg-[var(--chat-bg-hover)]'
                  : 'border-[var(--chat-border)] bg-[var(--chat-bg)] hover:bg-[var(--chat-bg-hover)]'
              "
            >
              <!-- Numbered badge -->
              <span
                class="w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold shrink-0"
                [class]="
                  i === selectedIndex()
                    ? 'bg-[var(--chat-send-bg)] text-[var(--chat-send-text)]'
                    : 'bg-[var(--chat-bg-alt)] text-[var(--chat-text-muted)]'
                "
              >
                {{ i + 1 }}
              </span>

              <!-- Checkpoint info -->
              <div class="flex-1 min-w-0">
                <p class="text-xs font-medium text-[var(--chat-text)] truncate">
                  {{ checkpointLabel(state, i) }}
                </p>
                @if (state.checkpoint?.checkpoint_id) {
                  <p class="text-xs text-[var(--chat-text-muted)] font-mono truncate">
                    {{ state.checkpoint.checkpoint_id }}
                  </p>
                }
              </div>

              <!-- Action buttons -->
              <div class="flex gap-1 shrink-0">
                <button
                  class="px-2 py-1 text-xs rounded bg-[var(--chat-bg-alt)] text-[var(--chat-text)] hover:bg-[var(--chat-bg-hover)] transition-colors"
                  title="Replay from this checkpoint"
                  (click)="replay(state, i)"
                >
                  Replay
                </button>
                <button
                  class="px-2 py-1 text-xs rounded bg-[var(--chat-bg-alt)] text-[var(--chat-text)] hover:bg-[var(--chat-bg-hover)] transition-colors"
                  title="Fork from this checkpoint"
                  (click)="fork(state, i)"
                >
                  Fork
                </button>
              </div>
            </div>
          }
        </div>
      </div>
    </example-chat-layout>
  `,
})
export class TimeTravelComponent {
  protected readonly agent = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  /** Index of the currently selected checkpoint in the sidebar. */
  protected readonly selectedIndex = signal<number>(-1);

  /** Checkpoint history derived from the agent. */
  protected readonly checkpoints = computed(
    (): ThreadState<any>[] => this.agent.langGraphHistory(),
  );

  /** Display label for a checkpoint entry. */
  protected checkpointLabel(
    state: ThreadState<any>,
    index: number,
  ): string {
    if (state.checkpoint?.checkpoint_id) {
      return `Checkpoint ${index + 1}`;
    }
    return `State ${index + 1}`;
  }

  /** Replay the conversation from the given checkpoint. */
  protected replay(state: ThreadState<any>, index: number): void {
    if (state.checkpoint?.checkpoint_id) {
      this.selectedIndex.set(index);
      this.agent.setBranch(state.checkpoint.checkpoint_id);
    }
  }

  /** Fork the conversation from the given checkpoint. */
  protected fork(state: ThreadState<any>, index: number): void {
    if (state.checkpoint?.checkpoint_id) {
      this.selectedIndex.set(index);
      this.agent.setBranch(state.checkpoint.checkpoint_id);
    }
  }
}
