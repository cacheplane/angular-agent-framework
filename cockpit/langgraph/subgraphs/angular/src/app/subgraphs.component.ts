// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, computed } from '@angular/core';
import { ChatComponent, ChatWelcomeSuggestionComponent } from '@threadplane/chat';
import { injectAgent } from '@threadplane/langgraph';
import { ExampleChatLayoutComponent } from '@threadplane/example-layouts';
import { SUBGRAPHS_AGENT } from './agent-ref';

const WELCOME_SUGGESTIONS = [
  // Labels asserted by e2e (subgraphs.spec.ts page.getByText) — do not change
  // without updating the spec and the aimock fixtures together.
  {
    label: 'Ask something that needs research',
    value: 'How does LangGraph checkpointing work?',
    description: 'Orchestrator routes into the research subgraph, then answers from its brief.',
  },
  {
    label: 'Ask something that does not',
    value: 'Hi there — what can you do?',
    description: 'Orchestrator skips the subgraph entirely and answers directly.',
  },
] as const;

/**
 * Subgraph composition cockpit example.
 *
 * The LangGraph backend is a parent graph with a compiled child graph added as
 * a plain node. The parent's `orchestrate` node classifies each turn and a
 * conditional edge decides whether execution enters the child at all.
 *
 * **Why this sidebar reads `agent.value()` and not `agent.subagents()`.**
 * `subagents()` is populated by the SubagentTracker, which keys on delegation
 * *tool calls* — a tool whose name is listed in `subagentToolNames` and whose
 * args carry a `subagent_type`, producing `tools:<id>` namespaced stream
 * events. A plain subgraph node emits a `research:<uuid>` namespace instead
 * and never appears in that map. See the Chat Subagents capability for the
 * tool-call path; this capability shows the composition primitive underneath
 * it, so child activity is read straight off the parent's own graph state.
 *
 * `research_topic` and `research_brief` are the only two keys the parent
 * shares with the child. The brief is rendered here, in the sidebar, and
 * nowhere else — `transcriptNodeNames: ['answer']` in `app.config.ts` keeps
 * everything except the parent's final turn out of the chat transcript.
 */
@Component({
  selector: 'app-subgraphs',
  standalone: true,
  imports: [ChatComponent, ChatWelcomeSuggestionComponent, ExampleChatLayoutComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      --st-nested: #2ea567;
      --st-direct: #e0a850;
    }
    .panel {
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .cap {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--ds-text-muted);
      margin: 0;
    }
    .route {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 13px;
      color: var(--ds-text-primary);
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      flex-shrink: 0;
      background: var(--ds-text-muted);
    }
    .dot--nested { background: var(--st-nested); }
    .dot--direct { background: var(--st-direct); }
    .hint {
      font-size: 12px;
      font-style: italic;
      color: var(--ds-text-muted);
      margin: 0;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .topic {
      font-family: var(--ds-font-mono);
      font-size: 12px;
      color: var(--ds-text-primary);
      word-break: break-word;
    }
    .brief {
      font-size: 12px;
      line-height: 1.5;
      color: var(--ds-text-primary);
      white-space: pre-wrap;
      word-break: break-word;
      margin: 0;
    }
  `,
  template: `
    <example-chat-layout>
      <chat main [agent]="agent" class="flex-1 min-w-0">
        <div chatWelcomeSuggestions>
          @for (s of suggestions; track s.value) {
            <chat-welcome-suggestion
              [label]="s.label"
              [value]="s.value"
              [description]="s.description"
              (selected)="send($event)"
            />
          }
        </div>
      </chat>

      <div sidebar class="panel" data-testid="subgraph-panel">
        <div class="field">
          <h3 class="cap">Route</h3>
          @if (delegated()) {
            <p class="route" data-testid="route">
              <span class="dot dot--nested"></span>Nested — research subgraph ran
            </p>
          } @else {
            <p class="route" data-testid="route">
              <span class="dot dot--direct"></span>Direct — subgraph skipped
            </p>
          }
        </div>

        @if (delegated()) {
          <div class="field">
            <h3 class="cap">Topic sent to child</h3>
            <code class="topic" data-testid="research-topic">{{ topic() }}</code>
          </div>

          <div class="field">
            <h3 class="cap">Brief returned by child</h3>
            @if (brief()) {
              <p class="brief" data-testid="research-brief">{{ brief() }}</p>
            } @else {
              <p class="hint">Running…</p>
            }
          </div>
          <p class="hint">
            The child graph's state has no <code>messages</code> key, so this brief
            never entered the transcript.
          </p>
        } @else {
          <p class="hint">
            The orchestrator answered without entering the child graph. Ask a
            factual question to route through it.
          </p>
        }
      </div>
    </example-chat-layout>
  `,
})
export class SubgraphsComponent {
  protected readonly suggestions = WELCOME_SUGGESTIONS;

  /**
   * Typed agent — `agent.value()` is `Signal<SubgraphsState>`, the parent
   * graph's live state as LangGraph streams `values` events.
   */
  protected readonly agent = injectAgent(SUBGRAPHS_AGENT);

  /** The topic the parent handed to the child graph this turn, if any. */
  protected readonly topic = computed(() => this.agent.value()?.research_topic ?? '');

  /** The brief the child graph handed back. */
  protected readonly brief = computed(() => this.agent.value()?.research_brief ?? '');

  /**
   * A non-empty topic is exactly what the parent's conditional edge routes on,
   * so it doubles as the UI's "did we nest?" signal.
   */
  protected readonly delegated = computed(() => this.topic().length > 0);

  protected send(text: string): void {
    void this.agent.submit({ message: text });
  }
}
