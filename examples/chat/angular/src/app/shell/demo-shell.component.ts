// SPDX-License-Identifier: MIT
import {
  Component,
  ChangeDetectionStrategy,
  DOCUMENT,
  DestroyRef,
  computed,
  effect,
  signal,
  inject,
} from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
import { agent } from '@ngaf/langgraph';
import { NgafTelemetryService } from '@ngaf/telemetry/browser';
import {
  ChatInterruptPanelComponent,
  ChatSubagentsComponent,
  ChatSidenavComponent,
  ChatHistorySearchPaletteComponent,
  ChatSelectComponent,
  type ChatSidenavMode,
  type InterruptAction,
  type ThreadMatch,
  type ThreadActionAdapter,
  type Thread,
  type ProjectActionAdapter,
} from '@ngaf/chat';
import { PalettePersistence } from './palette-persistence.service';
import { ThreadsService } from './threads.service';
import { ProjectsService } from './projects.service';
import { DEMO_AGENT } from './shell-tokens';
import { createCanonicalDemoRuntimeTelemetrySink } from './runtime-telemetry';
import { environment } from '../../environments/environment';

export type DemoMode = 'embed' | 'popup' | 'sidebar';

const MODES: readonly DemoMode[] = ['embed', 'popup', 'sidebar'] as const;
const TELEMETRY_SURFACE = 'canonical_demo';

function modeFromUrl(url: string): DemoMode {
  const seg = url.split('?')[0].split('/').filter(Boolean)[0];
  return (MODES as readonly string[]).includes(seg) ? (seg as DemoMode) : 'embed';
}

@Component({
  selector: 'demo-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    ChatInterruptPanelComponent,
    ChatSubagentsComponent,
    ChatSidenavComponent,
    ChatHistorySearchPaletteComponent,
    ChatSelectComponent,
  ],
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
  protected readonly threadsSvc = inject(ThreadsService);
  protected readonly projectsSvc = inject(ProjectsService);
  private readonly telemetry = inject(NgafTelemetryService);

  constructor() {
    // Reflect the chosen theme onto <html data-theme="..."> so the
    // global stylesheet's scoped --a2ui-* overrides activate. Runs on
    // signal change including initial mount (read from persistence).
    effect(() => {
      this.document.documentElement.setAttribute('data-theme', this.theme());
    });

    // App-wide color scheme: drives the demo page bg/text via
    // `data-color-scheme` and the chat-lib internals via
    // `data-ngaf-chat-theme`. The pre-bootstrap script in index.html
    // applies the initial value before stylesheets load; this effect
    // keeps both attrs synced after Angular takes over and also
    // auto-syncs the A2UI theme dropdown when it sits on a default
    // preset — material picks are left alone since the user opted in.
    effect(() => {
      const scheme = this.colorScheme();
      const html = this.document.documentElement;
      html.setAttribute('data-color-scheme', scheme);
      html.setAttribute('data-ngaf-chat-theme', scheme);
      const currentTheme = this.theme();
      if (currentTheme === 'default-dark' || currentTheme === 'default-light') {
        const next = scheme === 'light' ? 'default-light' : 'default-dark';
        if (currentTheme !== next) {
          this.theme.set(next);
          this.persistence.write('theme', next);
        }
      }
    });

    // Refresh threads list whenever the active thread changes (e.g. after
    // create or switch) so the panel stays up to date. The effect also
    // covers the initial load (fires synchronously on first reactive read).
    effect(() => {
      void this.threadIdSignal();
      void this.threadsSvc.refresh();
    });

    // Refresh threads list when an agent run completes. The backend writes
    // metadata.title on the first user message via _maybe_write_thread_title;
    // a refresh after run-end picks up the new title in the drawer without
    // needing a manual thread switch or reload.
    let lastStatus = this.agent.status();
    effect(() => {
      const status = this.agent.status();
      if (lastStatus === 'running' && status !== 'running') {
        void this.threadsSvc.refresh();
      }
      lastStatus = status;
    });

    if (typeof window !== 'undefined') {
      const onResize = () => this.viewportWidth.set(window.innerWidth);
      window.addEventListener('resize', onResize);
      inject(DestroyRef).onDestroy(() => window.removeEventListener('resize', onResize));
    }

    effect(() => {
      const q = this.searchQuery();
      if (this.searchDebounceTimer !== null) clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = setTimeout(() => {
        this.searchQueryDebounced.set(q);
      }, 150);
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

  /**
   * App-wide color scheme. Single source of truth for the demo page bg,
   * the chat lib's internal `data-ngaf-chat-theme`, and (when the A2UI
   * theme is on a default preset) the base A2UI theme. Persisted.
   */
  readonly colorScheme = signal<'light' | 'dark'>(
    (this.persistence.read('colorScheme') as 'light' | 'dark' | null) ?? 'dark',
  );

  /** Whether the threads drawer is open. Persisted across reloads. */
  protected readonly drawerOpen = signal<boolean>(this.persistence.read('drawerOpen') ?? false);

  /** Whether the Cmd+K search palette is open. */
  protected readonly paletteOpen = signal<boolean>(false);

  /** Current palette query. Two-way bound. */
  protected readonly searchQuery = signal<string>('');

  /** Debounced query — applied 150ms after the last keystroke. */
  private readonly searchQueryDebounced = signal<string>('');

  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  /** Viewport width, refreshed on window resize. Drives drawer push/overlay decision. */
  private readonly viewportWidth = signal<number>(
    typeof window !== 'undefined' ? window.innerWidth : 1440,
  );

  /**
   * User's chosen desktop sidenav mode. Persisted across reloads.
   * Below 1024px the shell ignores this and forces drawer mode.
   */
  private readonly storedDesktopMode = signal<'expanded' | 'collapsed'>(
    (this.persistence.read('sidenavMode') as 'expanded' | 'collapsed' | null) ?? 'expanded',
  );

  /** Computed sidenav mode: viewport forces drawer below 1024px, else user preference. */
  protected readonly sidenavMode = computed<ChatSidenavMode>(() =>
    this.viewportWidth() >= 1024 ? this.storedDesktopMode() : 'drawer',
  );

  /** Active threads filtered by the selected project (or all when none selected). */
  protected readonly visibleThreads = computed<Thread[]>(() => {
    const sel = this.selectedProjectId();
    const all = this.threadsSvc.threads();
    return sel === null ? all : all.filter((t) => t.projectId === sel);
  });

  /** Client-side title filter over the loaded threads. */
  protected readonly searchResults = computed<ThreadMatch[]>(() => {
    const q = this.searchQueryDebounced().toLowerCase().trim();
    if (!q) return [];
    const active = this.threadsSvc.threads()
      .filter((t) => (t.title ?? '').toLowerCase().includes(q))
      .map((t) => ({ id: t.id, title: t.title ?? t.id }));
    const archived = this.threadsSvc.archivedThreads()
      .filter((t) => (t.title ?? '').toLowerCase().includes(q))
      .map((t) => ({ id: t.id, title: t.title ?? t.id, subtitle: 'Archived' }));
    return [...active, ...archived].slice(0, 50);
  });

  protected readonly modeOptions = [
    { value: 'embed', label: 'Embed' },
    { value: 'popup', label: 'Popup' },
    { value: 'sidebar', label: 'Sidebar' },
  ] as const;

  readonly modelOptions = signal<readonly { value: string; label: string }[]>([
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
    { value: 'a2ui',        label: 'A2UI' },
    { value: 'json-render', label: 'json-render' },
  ]);

  protected readonly themeOptions = signal<readonly { value: string; label: string }[]>([
    { value: 'default-dark',   label: 'Default dark' },
    { value: 'default-light',  label: 'Default light' },
    { value: 'material-dark',  label: 'Material dark' },
    { value: 'material-light', label: 'Material light' },
  ]);

  /** Persisted thread id (null on first run). Reactive so reload reconnects to the same thread. */
  protected readonly threadIdSignal = signal<string | null>(this.persistence.read('threadId') ?? null);

  /** Title of the currently-selected thread, or 'New chat' if none. The
   *  Python graph writes thread.metadata.title from the first user message
   *  via _maybe_write_thread_title; threadsSvc surfaces it via threads(). */
  readonly currentThreadTitle = computed(() => {
    const id = this.threadIdSignal();
    if (!id) return 'New chat';
    const thread = this.threadsSvc.threads().find((t) => t.id === id);
    return thread?.title ?? 'New chat';
  });

  protected readonly selectedProjectId = signal<string | null>(
    this.persistence.read('selectedProjectId') ?? null,
  );

  protected readonly projectActions: ProjectActionAdapter = {
    create: async (name) => {
      const r = await this.projectsSvc.create(name);
      this.selectedProjectId.set(r.id);
      this.persistence.write('selectedProjectId', r.id);
      return r;
    },
    rename: (id, name) => this.projectsSvc.rename(id, name),
    delete: async (id) => {
      await this.projectsSvc.delete(id);
      if (this.selectedProjectId() === id) {
        this.selectedProjectId.set(null);
        this.persistence.write('selectedProjectId', null);
      }
    },
  };

  protected readonly threadActions: ThreadActionAdapter = {
    delete: async (id) => {
      await this.threadsSvc.delete(id);
      if (this.threadIdSignal() === id) {
        this.threadIdSignal.set(null);
        this.persistence.write('threadId', null);
      }
    },
    rename: (id, title) => this.threadsSvc.rename(id, title),
    archive: async (id) => {
      await this.threadsSvc.archive(id);
      if (this.threadIdSignal() === id) {
        this.threadIdSignal.set(null);
        this.persistence.write('threadId', null);
      }
    },
    unarchive: (id) => this.threadsSvc.unarchive(id),
    pin: (id) => this.threadsSvc.pin(id),
    unpin: (id) => this.threadsSvc.unpin(id),
    moveToProject: async (id, projectId) => {
      await this.threadsSvc.moveToProject(id, projectId);
    },
    reorderPinned: (id, beforeId) => this.threadsSvc.reorderPinned(id, beforeId),
  };

  /**
   * Shared agent instance. Patched submit injects state.model on every
   * submission so the graph picks up the latest model selection without
   * a reconnect.
   */
  readonly agent = (() => {
    const a = agent({
      apiUrl: environment.langGraphApiUrl,
      assistantId: environment.assistantId,
      threadId: this.threadIdSignal,
      onThreadId: (id: string) => {
        this.threadIdSignal.set(id);
        this.persistence.write('threadId', id);
      },
      // Phase 3B: tells SubagentTracker to treat `research` tool calls as
      // subagent dispatches and to materialize agent.subagents() from the
      // resulting tools:<id>-namespaced stream events.
      subagentToolNames: ['research'],
      telemetry: createCanonicalDemoRuntimeTelemetrySink(
        this.telemetry,
        () => this.model(),
      ),
    });
    void this.telemetry.capture('ngaf:browser_chat_init', { surface: TELEMETRY_SURFACE });
    const orig = a.submit.bind(a);
    (a as { submit: typeof a.submit }).submit = (async (
      input: Parameters<typeof a.submit>[0],
      opts?: Parameters<typeof a.submit>[1],
    ) => {
      return orig(
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
      );
    }) as typeof a.submit;
    return a;
  })();

  protected onModeChange(next: DemoMode | string): void {
    void this.router.navigate(['/' + next]);
  }

  onModelChange(next: string): void {
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

  protected onColorSchemeChange(next: 'light' | 'dark' | string): void {
    if (next !== 'light' && next !== 'dark') return;
    this.colorScheme.set(next);
    this.persistence.write('colorScheme', next);
  }

  protected onSidenavOpenChange(next: boolean): void {
    this.drawerOpen.set(next);
    this.persistence.write('drawerOpen', next);
  }

  protected toggleSidenav(): void {
    this.onSidenavOpenChange(!this.drawerOpen());
  }

  protected onSidenavModeChange(next: ChatSidenavMode): void {
    // Drawer is viewport-driven; ignore user attempts to set it directly.
    if (next === 'drawer') return;
    this.storedDesktopMode.set(next);
    this.persistence.write('sidenavMode', next);
  }

  onTimelineReplay(checkpointId: string): void {
    void this.agent.submit(null as never, { checkpointId } as never);
  }

  async onTimelineFork(checkpointId: string): Promise<void> {
    const id = await this.threadsSvc.create();
    if (!id) return;
    this.threadIdSignal.set(id);
    this.persistence.write('threadId', id);
    void this.agent.submit(null as never, { checkpointId } as never);
  }

  /** Switch to an existing thread selected from the threads panel. */
  protected onThreadSelected(threadId: string): void {
    this.threadIdSignal.set(threadId);
    this.persistence.write('threadId', threadId);
  }

  protected onProjectSelected(projectId: string): void {
    this.selectedProjectId.set(projectId);
    this.persistence.write('selectedProjectId', projectId);
  }

  protected onNewProjectClicked(): void {
    // Framework's chat-project-list owns the inline-create flow; this is an
    // informational event for the consumer.
  }

  protected onSearchSelect(threadId: string): void {
    this.onThreadSelected(threadId);
    this.paletteOpen.set(false);
    this.searchQuery.set('');
  }

  /** Create a new thread via the backend and switch to it. */
  protected async onNewThread(): Promise<void> {
    const sel = this.selectedProjectId();
    const id = await this.threadsSvc.create(sel ?? undefined);
    if (id) {
      this.threadIdSignal.set(id);
      this.persistence.write('threadId', id);
    }
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
