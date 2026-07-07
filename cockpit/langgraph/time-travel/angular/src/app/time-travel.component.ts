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
  styles: `
    .panel {
      display: flex;
      flex-direction: column;
      overflow: hidden;
      height: 100%;
      background: var(--ds-surface, #1c1c1c);
      color: var(--ds-text-primary, #f5f5f5);
    }
    .head {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--ds-border, #2d2d2d);
    }
    .cap {
      margin: 0;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--ds-text-muted, #a0a0a0);
    }
    .sub {
      margin: 4px 0 0;
      font-size: 12px;
      color: var(--ds-text-muted, #a0a0a0);
    }
    .list {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 0.5rem 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .empty {
      padding: 1.5rem 0;
      font-size: 13px;
      font-style: italic;
      text-align: center;
      color: var(--ds-text-muted, #a0a0a0);
    }
    .row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 6px 10px;
      border: 1px solid var(--ds-border, #2d2d2d);
      border-radius: var(--ds-radius-md, 10px);
      background: var(--ds-surface, #1c1c1c);
      transition: background 0.15s ease, border-color 0.15s ease;
    }
    .row:hover {
      background: var(--ds-surface-tinted, rgba(255, 255, 255, 0.04));
    }
    .row--active {
      background: var(--ds-accent-surface, rgba(100, 195, 253, 0.08));
      border-color: var(--ds-accent-border, rgba(100, 195, 253, 0.25));
    }
    .badge {
      flex-shrink: 0;
      width: 24px;
      height: 24px;
      border-radius: 999px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      background: var(--ds-surface-tinted, rgba(255, 255, 255, 0.06));
      color: var(--ds-text-muted, #a0a0a0);
    }
    .badge--active {
      background: var(--ds-accent, #64c3fd);
      color: #08243a;
    }
    .info {
      flex: 1;
      min-width: 0;
    }
    .label {
      margin: 0;
      font-size: 12px;
      font-weight: 500;
      color: var(--ds-text-primary, #f5f5f5);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .id {
      margin: 2px 0 0;
      font-family: var(--ds-font-mono, ui-monospace, monospace);
      font-size: 11px;
      color: var(--ds-text-muted, #a0a0a0);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .actions {
      flex-shrink: 0;
      display: flex;
      gap: 4px;
    }
    .btn {
      padding: 4px 8px;
      font-size: 11px;
      border-radius: var(--ds-radius-sm, 6px);
      border: 1px solid var(--ds-border, #2d2d2d);
      background: var(--ds-surface-dim, #0a0a0a);
      color: var(--ds-text-secondary, #c8c8c8);
      cursor: pointer;
      transition: border-color 0.15s ease, color 0.15s ease;
    }
    .btn:hover {
      border-color: var(--ds-accent-border, rgba(100, 195, 253, 0.25));
      color: var(--ds-accent, #64c3fd);
    }
  `,
  template: `
    <example-chat-layout>
      <!-- Chat panel -->
      <chat main [agent]="agent" class="block flex-1" />

      <!-- Checkpoint timeline sidebar -->
      <div sidebar class="panel">
        <div class="head">
          <h2 class="cap">Timeline</h2>
          <p class="sub">{{ checkpoints().length }} checkpoint(s)</p>
        </div>

        <div class="list">
          @if (checkpoints().length === 0) {
            <p class="empty">No checkpoints yet. Send a message to begin.</p>
          }

          @for (state of checkpoints(); track $index; let i = $index) {
            <div class="row" [class.row--active]="i === selectedIndex()">
              <!-- Numbered badge -->
              <span class="badge" [class.badge--active]="i === selectedIndex()">
                {{ i + 1 }}
              </span>

              <!-- Checkpoint info -->
              <div class="info">
                <p class="label">{{ checkpointLabel(state, i) }}</p>
                @if (state.checkpoint?.checkpoint_id) {
                  <p class="id">{{ state.checkpoint.checkpoint_id }}</p>
                }
              </div>

              <!-- Action buttons -->
              <div class="actions">
                <button
                  class="btn"
                  title="Replay from this checkpoint"
                  (click)="replay(state, i)"
                >
                  Replay
                </button>
                <button
                  class="btn"
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
