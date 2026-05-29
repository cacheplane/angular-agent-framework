import { Component, computed, signal } from '@angular/core';
import { ChatComponent } from '@threadplane/chat';
import { injectAgent } from '@threadplane/langgraph';
import type { ThreadState } from '@threadplane/langgraph';
import { ExampleChatLayoutComponent } from '@threadplane/example-layouts';

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
        style="background: var(--ngaf-chat-bg); color: var(--ngaf-chat-text);"
      >
        <div class="px-4 py-3 border-b border-[var(--ngaf-chat-separator)]">
          <h2 class="text-sm font-semibold text-[var(--ngaf-chat-text)] uppercase tracking-wide">
            Timeline
          </h2>
          <p class="text-xs text-[var(--ngaf-chat-text-muted)] mt-0.5">
            {{ checkpoints().length }} checkpoint(s)
          </p>
        </div>

        <div class="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
          @if (checkpoints().length === 0) {
            <p class="text-xs text-[var(--ngaf-chat-text-muted)] text-center py-6">
              No checkpoints yet. Send a message to begin.
            </p>
          }

          @for (state of checkpoints(); track $index; let i = $index) {
            <div
              class="flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors"
              [class]="
                i === selectedIndex()
                  ? 'border-[var(--ngaf-chat-primary)] bg-[var(--ngaf-chat-surface-alt)]'
                  : 'border-[var(--ngaf-chat-separator)] bg-[var(--ngaf-chat-bg)] hover:bg-[var(--ngaf-chat-surface-alt)]'
              "
            >
              <!-- Numbered badge -->
              <span
                class="w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold shrink-0"
                [class]="
                  i === selectedIndex()
                    ? 'bg-[var(--ngaf-chat-primary)] text-[var(--ngaf-chat-on-primary)]'
                    : 'bg-[var(--ngaf-chat-surface-alt)] text-[var(--ngaf-chat-text-muted)]'
                "
              >
                {{ i + 1 }}
              </span>

              <!-- Checkpoint info -->
              <div class="flex-1 min-w-0">
                <p class="text-xs font-medium text-[var(--ngaf-chat-text)] truncate">
                  {{ checkpointLabel(state, i) }}
                </p>
                @if (state.checkpoint?.checkpoint_id) {
                  <p class="text-xs text-[var(--ngaf-chat-text-muted)] font-mono truncate">
                    {{ state.checkpoint.checkpoint_id }}
                  </p>
                }
              </div>

              <!-- Action buttons -->
              <div class="flex gap-1 shrink-0">
                <button
                  class="px-2 py-1 text-xs rounded bg-[var(--ngaf-chat-surface-alt)] text-[var(--ngaf-chat-text)] hover:bg-[var(--ngaf-chat-surface-alt)] transition-colors"
                  title="Replay from this checkpoint"
                  (click)="replay(state, i)"
                >
                  Replay
                </button>
                <button
                  class="px-2 py-1 text-xs rounded bg-[var(--ngaf-chat-surface-alt)] text-[var(--ngaf-chat-text)] hover:bg-[var(--ngaf-chat-surface-alt)] transition-colors"
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
  protected readonly agent = injectAgent();

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
