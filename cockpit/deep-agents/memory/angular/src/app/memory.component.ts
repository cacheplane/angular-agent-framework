import { Component, computed } from '@angular/core';
import { ChatComponent, ChatWelcomeSuggestionComponent } from '@threadplane/chat';
import { ExampleChatLayoutComponent } from '@threadplane/example-layouts';
import { injectAgent } from '@threadplane/langgraph';

/** Name of the custom stream event the graph's visibility middleware emits. */
const MEMORY_EVENT = 'deep_agents.memory';

interface MemoryFile {
  path: string;
  contents: string;
  lines: string[];
}

const SUGGESTIONS = [
  // values match cockpit/deep-agents/memory/angular/e2e/da-memory.spec.ts prompts.
  {
    label: 'Tell it about your operation',
    value:
      'I fly a Citation CJ3 out of KASE, and I always want briefings in bullet points. Please remember that.',
    description: 'The agent edits its own memory file.',
  },
  {
    label: 'Start over and ask what it knows',
    value: 'What do you already know about my operation?',
    description: 'Reload first: a new thread still loads the same memory.',
  },
] as const;

/**
 * MemoryComponent shows the file the agent keeps about you.
 *
 * The memory is not a state key this app maintains. `MemoryMiddleware` loads
 * `/memories/AGENTS.md` into the system prompt at the start of every turn and
 * the agent rewrites it with `edit_file` when it learns something durable.
 * `StoreBackend` puts that file in LangGraph's store rather than on the thread,
 * so a brand new thread starts already knowing.
 *
 * Reading it back needs a detour. `MemoryMiddleware` annotates `memory_contents`
 * with `PrivateStateAttr`, which keeps it out of the `values` stream entirely,
 * so a panel bound to `agent.value()` alone would stay empty during a live run.
 * Two sources cover the two cases:
 *
 * - live: the graph republishes the key as a `custom` stream event, which
 *   arrives on `agent.customEvents()`;
 * - settled: the key IS present in the thread's checkpoint, so once the client
 *   has hydrated a thread, `agent.value()` carries it.
 *
 * The custom event wins when both are present, because it is the fresher of
 * the two during a run.
 */
@Component({
  selector: 'app-da-memory',
  standalone: true,
  imports: [ChatComponent, ChatWelcomeSuggestionComponent, ExampleChatLayoutComponent],
  template: `
    <example-chat-layout sidebarWidth="22rem">
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
      <!-- #region memory-panel -->
      <div sidebar class="panel">
        <h3 class="cap">Agent Memory</h3>
        <p class="source" data-testid="memory-source" [attr.data-source]="memorySource()">
          {{ memorySource() === 'live' ? 'streamed live' : memorySource() === 'checkpoint' ? 'from checkpoint' : 'no source yet' }}
        </p>
        @if (memoryFiles().length === 0) {
          <p class="empty">Nothing remembered yet</p>
        }
        @for (file of memoryFiles(); track file.path) {
          <div class="mem" data-testid="memory-file" [attr.data-path]="file.path">
            <span class="mem__path">{{ file.path }}</span>
            @for (line of file.lines; track $index) {
              <p class="mem__line" data-testid="memory-line">{{ line }}</p>
            }
          </div>
        }
        <p class="hint">
          This file lives in the LangGraph store, not on the thread. Reload the page to start a
          new conversation and it will still be here.
        </p>
      </div>
      <!-- #endregion -->
    </example-chat-layout>
  `,
  styles: [
    `
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
        text-transform: uppercase;
      }

      .source {
        margin: 0;
        color: var(--tplane-chat-text-muted);
        font-family: var(--tplane-chat-font-mono);
        font-size: var(--tplane-chat-font-size-xs);
      }

      .empty {
        margin: 0;
        color: var(--tplane-chat-text-muted);
        font-size: var(--tplane-chat-font-size-sm);
        font-style: italic;
      }

      .mem {
        display: flex;
        flex-direction: column;
        gap: 0.125rem;
        padding: 0.5rem;
        border-radius: var(--tplane-chat-radius-card);
        background: var(--tplane-chat-surface-alt);
      }

      .mem__path {
        color: var(--tplane-chat-text-muted);
        font-family: var(--tplane-chat-font-mono);
        font-size: var(--tplane-chat-font-size-xs);
      }

      .mem__line {
        margin: 0;
        color: var(--tplane-chat-text);
        font-size: var(--tplane-chat-font-size-sm);
      }

      .hint {
        margin: 0;
        color: var(--tplane-chat-text-muted);
        font-size: var(--tplane-chat-font-size-xs);
        line-height: var(--tplane-chat-line-height);
      }
    `,
  ],
})
export class MemoryComponent {
  protected readonly agent = injectAgent();

  protected readonly suggestions = SUGGESTIONS;

  // #region memory-sources
  /** Latest `memory_contents` announced on the custom stream. */
  private readonly liveMemory = computed<Record<string, string> | null>(() => {
    for (const event of [...this.agent.customEvents()].reverse()) {
      if (event.name !== MEMORY_EVENT) continue;
      const contents = (event.data as { memory_contents?: unknown } | undefined)?.[
        'memory_contents'
      ];
      if (contents && typeof contents === 'object') return contents as Record<string, string>;
    }
    return null;
  });

  /**
   * `memory_contents` off the hydrated thread state.
   *
   * The key is private to the `values` stream but is written to the
   * checkpoint, so this covers a reopened thread where no custom event has
   * fired in this session.
   */
  private readonly settledMemory = computed<Record<string, string> | null>(() => {
    const contents = (this.agent.value() as Record<string, unknown> | undefined)?.[
      'memory_contents'
    ];
    return contents && typeof contents === 'object'
      ? (contents as Record<string, string>)
      : null;
  });
  // #endregion

  // #region memory-source-label
  /**
   * Which of the two sources the panel is currently showing.
   *
   * `live` means the graph's visibility middleware announced the key on the
   * custom stream during this run. `checkpoint` means only the settle-time
   * hydration has it — which is what a reopened thread looks like, and also
   * what the panel degrades to if the middleware is removed.
   */
  protected readonly memorySource = computed<'live' | 'checkpoint' | 'none'>(() => {
    const live = this.liveMemory();
    if (live && Object.keys(live).length > 0) return 'live';
    return this.settledMemory() ? 'checkpoint' : 'none';
  });
  // #endregion

  protected readonly memoryFiles = computed<MemoryFile[]>(() => {
    const live = this.liveMemory();
    const source = live && Object.keys(live).length > 0 ? live : this.settledMemory();
    if (!source) return [];
    return Object.entries(source)
      .filter(([, contents]) => typeof contents === 'string' && contents.trim().length > 0)
      .map(([path, contents]) => ({
        path,
        contents,
        lines: contents
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0),
      }))
      .sort((a, b) => a.path.localeCompare(b.path));
  });

  protected send(text: string): void {
    void this.agent.submit({ message: text });
  }
}
