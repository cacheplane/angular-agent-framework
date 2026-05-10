// SPDX-License-Identifier: MIT
import {
  Component,
  ChangeDetectionStrategy,
  DOCUMENT,
  effect,
  signal,
  inject,
} from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
import { agent } from '@ngaf/langgraph';
import { ChatDebugComponent, ChatInterruptPanelComponent, ChatSubagentsComponent, ChatTimelineSliderComponent, type InterruptAction } from '@ngaf/chat';
import { ControlPalette } from './control-palette.component';
import { PalettePersistence } from './palette-persistence.service';
import { DEMO_AGENT } from './shell-tokens';

export type DemoMode = 'embed' | 'popup' | 'sidebar';

const MODES: readonly DemoMode[] = ['embed', 'popup', 'sidebar'] as const;

function modeFromUrl(url: string): DemoMode {
  const seg = url.split('?')[0].split('/').filter(Boolean)[0];
  return (MODES as readonly string[]).includes(seg) ? (seg as DemoMode) : 'embed';
}

@Component({
  selector: 'demo-shell',
  standalone: true,
  imports: [RouterOutlet, ControlPalette, ChatDebugComponent, ChatInterruptPanelComponent, ChatSubagentsComponent, ChatTimelineSliderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './demo-shell.component.html',
  styleUrl: './demo-shell.component.css',
  providers: [
    { provide: DEMO_AGENT, useFactory: () => inject(DemoShell).agent },
  ],
})
export class DemoShell {
  private readonly router = inject(Router);
  private readonly persistence = inject(PalettePersistence);
  private readonly document = inject(DOCUMENT);

  constructor() {
    // Reflect the chosen theme onto <html data-theme="..."> so the
    // global stylesheet's scoped --a2ui-* overrides activate. Runs on
    // signal change including initial mount (read from persistence).
    effect(() => {
      this.document.documentElement.setAttribute('data-theme', this.theme());
    });
  }

  protected readonly mode = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => modeFromUrl(e.urlAfterRedirects)),
      startWith(modeFromUrl(this.router.url)),
      takeUntilDestroyed(),
    ),
    { initialValue: modeFromUrl(this.router.url) },
  );

  /**
   * Source of truth for the model picker. The shell owns it; the
   * patched submit injects it into state on every send.
   */
  readonly model = signal<string>(this.persistence.read('model') ?? 'gpt-5-mini');

  /** Reasoning effort for the next submit. Persisted across reloads. */
  readonly effort = signal<string>(this.persistence.read('effort') ?? 'minimal');

  /**
   * GenUI dispatch mode for the next UI-render prompt. Controls which
   * sub-LLM tool the graph calls (generate_a2ui_schema vs
   * generate_json_render_spec). Persisted across reloads.
   */
  readonly genUiMode = signal<string>(this.persistence.read('genUiMode') ?? 'a2ui');

  /**
   * A2UI theme preset for the rendered surface. Toggles a `data-theme`
   * attribute on the document root which the global stylesheet keys
   * scoped `--a2ui-*` overrides off. Persisted across reloads.
   */
  readonly theme = signal<string>(this.persistence.read('theme') ?? 'default-dark');

  protected readonly debugOpen = signal<boolean>(this.persistence.read('debug') ?? false);

  protected readonly timelineOpen = signal<boolean>(this.persistence.read('timeline') ?? false);

  protected readonly modelOptions = signal<readonly { value: string; label: string }[]>([
    { value: 'gpt-5', label: 'gpt-5' },
    { value: 'gpt-5-mini', label: 'gpt-5-mini' },
    { value: 'gpt-5-nano', label: 'gpt-5-nano' },
  ]);

  protected readonly effortOptions = signal<readonly { value: string; label: string }[]>([
    { value: 'minimal', label: 'minimal (fast)' },
    { value: 'low',     label: 'low' },
    { value: 'medium',  label: 'medium' },
    { value: 'high',    label: 'high (visible reasoning)' },
  ]);

  protected readonly genUiOptions = signal<readonly { value: string; label: string }[]>([
    { value: 'a2ui',        label: 'A2UI v1' },
    { value: 'json-render', label: 'json-render' },
  ]);

  protected readonly themeOptions = signal<readonly { value: string; label: string }[]>([
    { value: 'default-dark',   label: 'Default dark' },
    { value: 'default-light',  label: 'Default light' },
    { value: 'material-dark',  label: 'Material dark' },
    { value: 'material-light', label: 'Material light' },
  ]);

  /** Persisted thread id (null on first run). Reactive so reload reconnects to the same thread. */
  private readonly threadIdSignal = signal<string | null>(this.persistence.read('threadId') ?? null);

  /**
   * Shared agent instance. Patched submit injects state.model on every
   * submission so the graph picks up the latest model selection without
   * a reconnect.
   */
  readonly agent = (() => {
    const a = agent({
      apiUrl: 'http://localhost:2024',
      assistantId: 'chat',
      threadId: this.threadIdSignal,
      onThreadId: (id: string) => {
        this.threadIdSignal.set(id);
        this.persistence.write('threadId', id);
      },
      // Phase 3B: tells SubagentTracker to treat `research` tool calls as
      // subagent dispatches and to materialize agent.subagents() from the
      // resulting tools:<id>-namespaced stream events.
      subagentToolNames: ['research'],
    });
    const orig = a.submit.bind(a);
    (a as { submit: typeof a.submit }).submit = ((
      input: Parameters<typeof a.submit>[0],
      opts?: Parameters<typeof a.submit>[1],
    ) =>
      orig(
        {
          ...(input ?? {}),
          state: {
            ...((input as { state?: Record<string, unknown> })?.state ?? {}),
            model: this.model(),
            reasoning_effort: this.effort(),
            gen_ui_mode: this.genUiMode(),
          },
        },
        opts,
      )) as typeof a.submit;
    return a;
  })();

  protected onModeChange(next: DemoMode): void {
    void this.router.navigate(['/' + next]);
  }

  protected onModelChange(next: string): void {
    this.model.set(next);
    this.persistence.write('model', next);
  }

  protected onEffortChange(next: string): void {
    this.effort.set(next);
    this.persistence.write('effort', next);
  }

  protected onGenUiModeChange(next: string): void {
    this.genUiMode.set(next);
    this.persistence.write('genUiMode', next);
  }

  protected onThemeChange(next: string): void {
    this.theme.set(next);
    this.persistence.write('theme', next);
  }

  protected onDebugChange(next: boolean): void {
    this.debugOpen.set(next);
    this.persistence.write('debug', next);
  }

  protected onTimelineChange(next: boolean): void {
    this.timelineOpen.set(next);
    this.persistence.write('timeline', next);
  }

  protected onTimelineReplay(checkpointId: string): void {
    void this.agent.submit(null as never, { checkpointId } as never);
  }

  protected async onTimelineFork(checkpointId: string): Promise<void> {
    await fetch('http://localhost:2024/threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
      .then((r) => r.json())
      .then((t: { thread_id: string }) => {
        this.threadIdSignal.set(t.thread_id);
        this.persistence.write('threadId', t.thread_id);
        void this.agent.submit(null as never, { checkpointId } as never);
      });
  }

  /**
   * Clear persisted thread id and drop the signal. The next submit
   * causes the SDK to create a fresh thread server-side; onThreadId
   * fires and re-persists it.
   */
  protected onNewConversation(): void {
    this.persistence.write('threadId', null);
    this.threadIdSignal.set(null);
  }

  /**
   * Translates the four-action vocabulary from chat-interrupt-panel
   * into Command(resume=value) submissions. Phase 3A demo affordance:
   * window.prompt() for `edit` and `respond`. A production app would
   * inline a textarea editor.
   */
  protected async onInterruptAction(action: InterruptAction): Promise<void> {
    const interrupt = this.agent.interrupt?.();
    if (!interrupt) return;

    let resume: unknown;
    switch (action) {
      case 'accept':
        resume = 'approved';
        break;
      case 'edit': {
        const reason = (interrupt.value as { reason?: string })?.reason ?? '';
        const edited = window.prompt(
          `Edit your response (current proposal: "${reason}"):`,
          'approved',
        );
        if (edited == null) return;
        resume = edited;
        break;
      }
      case 'respond': {
        const text = window.prompt('Respond to the agent:', '');
        if (text == null) return;
        resume = text;
        break;
      }
      case 'ignore':
        resume = 'denied';
        break;
    }

    await this.agent.submit(null, { command: { resume } } as never);
  }
}
