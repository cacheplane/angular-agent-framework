import { Component, computed } from '@angular/core';
import { ChatComponent, ChatWelcomeSuggestionComponent } from '@threadplane/chat';
import { ExampleChatLayoutComponent } from '@threadplane/example-layouts';
import { injectAgent } from '@threadplane/langgraph';

/** Name of the custom stream event the graph's visibility middleware emits. */
const SKILLS_EVENT = 'deep_agents.skills';

/** One entry of `skills_metadata`, parsed from a SKILL.md frontmatter block. */
interface SkillEntry {
  name: string;
  description: string;
  path: string;
  /** Directory the skill lives in, used to match files the agent opened. */
  root: string;
  /** Files under this skill the agent has read during the run. */
  opened: string[];
}

const SUGGESTIONS = [
  // value matches cockpit/deep-agents/skills/angular/e2e/da-skills.spec.ts PROMPT.
  {
    label: 'Mid-size jet at KASE',
    value: 'Can a mid-size jet operate out of KASE?',
    description: 'Matches the runway-analysis skill, which sends the agent to its margin table.',
  },
] as const;

/**
 * SkillsComponent shows progressive disclosure happening.
 *
 * `SkillsMiddleware` loads only each SKILL.md's frontmatter — a name and a
 * description — into the system prompt. The body stays on the filesystem until
 * a request matches, and a reference file inside the skill stays unread until
 * the SKILL.md sends the agent to it. The panel therefore has two halves: the
 * index the model was given up front, and the files it actually opened.
 *
 * The index is not on the `values` stream: `skills_metadata` is annotated
 * `PrivateStateAttr`. The graph republishes it as a `custom` stream event, and
 * the checkpoint carries it for a reopened thread — the same two-source pattern
 * as the memory capability.
 *
 * The opened files come from the ordinary tool-call stream, because `read_file`
 * is not private at all.
 */
@Component({
  selector: 'app-skills',
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
      <div sidebar class="panel">
        <h3 class="cap">Skill Index</h3>
        <p class="source" data-testid="skills-source" [attr.data-source]="skillsSource()">
          {{ skillsSource() === 'live' ? 'streamed live' : skillsSource() === 'checkpoint' ? 'from checkpoint' : 'no source yet' }}
        </p>
        @if (skills().length === 0) {
          <p class="empty">No skills loaded</p>
        }
        @for (skill of skills(); track skill.name) {
          <div
            class="skill"
            data-testid="skill"
            [attr.data-name]="skill.name"
            [attr.data-opened]="skill.opened.length > 0 ? 'true' : 'false'"
          >
            <span class="skill__name">{{ skill.name }}</span>
            <p class="skill__description">{{ skill.description }}</p>
            @if (skill.opened.length === 0) {
              <p class="skill__files skill__files--idle">body not read</p>
            } @else {
              @for (file of skill.opened; track file) {
                <p class="skill__files" data-testid="skill-open">{{ file }}</p>
              }
            }
          </div>
        }
        <p class="hint">
          Only the name and description above were put in the model's prompt. Everything else was
          read on demand.
        </p>
      </div>
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

      .skill {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        padding: 0.5rem;
        border-radius: var(--tplane-chat-radius-card);
        background: var(--tplane-chat-surface-alt);
      }

      .skill[data-opened='true'] {
        outline: 1px solid var(--tplane-chat-primary);
      }

      .skill__name {
        color: var(--tplane-chat-text);
        font-family: var(--tplane-chat-font-mono);
        font-size: var(--tplane-chat-font-size-sm);
      }

      .skill__description {
        margin: 0;
        color: var(--tplane-chat-text-muted);
        font-size: var(--tplane-chat-font-size-xs);
        line-height: var(--tplane-chat-line-height);
      }

      .skill__files {
        margin: 0;
        color: var(--tplane-chat-text);
        font-family: var(--tplane-chat-font-mono);
        font-size: var(--tplane-chat-font-size-xs);
      }

      .skill__files--idle {
        color: var(--tplane-chat-text-muted);
        font-style: italic;
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
export class SkillsComponent {
  protected readonly agent = injectAgent();

  protected readonly suggestions = SUGGESTIONS;

  private readonly liveSkills = computed<Record<string, unknown>[] | null>(() => {
    for (const event of [...this.agent.customEvents()].reverse()) {
      if (event.name !== SKILLS_EVENT) continue;
      const metadata = (event.data as { skills_metadata?: unknown } | undefined)?.[
        'skills_metadata'
      ];
      if (Array.isArray(metadata) && metadata.length > 0) {
        return metadata as Record<string, unknown>[];
      }
    }
    return null;
  });

  private readonly settledSkills = computed<Record<string, unknown>[] | null>(() => {
    const metadata = (this.agent.value() as Record<string, unknown> | undefined)?.[
      'skills_metadata'
    ];
    return Array.isArray(metadata) && metadata.length > 0
      ? (metadata as Record<string, unknown>[])
      : null;
  });

  protected readonly skillsSource = computed<'live' | 'checkpoint' | 'none'>(() => {
    if (this.liveSkills()) return 'live';
    return this.settledSkills() ? 'checkpoint' : 'none';
  });

  /** Absolute paths the agent has read with `read_file` during this run. */
  private readonly openedPaths = computed<string[]>(() => {
    const paths: string[] = [];
    for (const call of this.agent.toolCalls()) {
      if (call.name !== 'read_file') continue;
      const path = (call.args as Record<string, unknown> | undefined)?.['file_path'];
      if (typeof path === 'string' && !paths.includes(path)) paths.push(path);
    }
    return paths;
  });

  protected readonly skills = computed<SkillEntry[]>(() => {
    const source = this.liveSkills() ?? this.settledSkills() ?? [];
    const opened = this.openedPaths();
    return source.map((entry) => {
      const path = String(entry['path'] ?? '');
      const root = path.slice(0, path.lastIndexOf('/') + 1);
      return {
        name: String(entry['name'] ?? ''),
        description: String(entry['description'] ?? ''),
        path,
        root,
        opened: root ? opened.filter((candidate) => candidate.startsWith(root)) : [],
      };
    });
  });

  protected send(text: string): void {
    void this.agent.submit({ message: text });
  }
}
