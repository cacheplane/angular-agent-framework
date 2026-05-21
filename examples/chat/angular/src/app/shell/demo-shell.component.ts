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
  untracked,
} from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
import { agent, LangGraphThreadsAdapter, refreshOnRunEnd } from '@ngaf/langgraph';
import { NgafTelemetryService } from '@ngaf/telemetry/browser';
import {
  ChatInterruptPanelComponent,
  ChatSubagentsComponent,
  ChatSidenavComponent,
  ChatSidenavScrimComponent,
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
import { ProjectsService } from './projects.service';
import { DEMO_AGENT } from './shell-tokens';
import { createCanonicalDemoRuntimeTelemetrySink } from './runtime-telemetry';
import { environment } from '../../environments/environment';

export type DemoMode = 'embed' | 'popup' | 'sidebar';

const MODES: readonly DemoMode[] = ['embed', 'popup', 'sidebar'] as const;
const TELEMETRY_SURFACE = 'canonical_demo';

/** Parse `/embed`, `/embed/<threadId>`, `/popup/<threadId>` etc. into
 *  `{mode, threadId}`. Source of truth for URL ↔ signal sync — see
 *  spec 2026-05-20-url-thread-routing-design.md. */
function parseUrl(url: string): { mode: DemoMode; threadId: string | null } {
  const segs = url.split('?')[0].split('#')[0].split('/').filter(Boolean);
  const mode = (MODES as readonly string[]).includes(segs[0]) ? (segs[0] as DemoMode) : 'embed';
  const threadId = segs[1] && segs[1].length > 0 ? segs[1] : null;
  return { mode, threadId };
}

@Component({
  selector: 'demo-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    ChatInterruptPanelComponent,
    ChatSubagentsComponent,
    ChatSidenavComponent,
    ChatSidenavScrimComponent,
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
  protected readonly threadsSvc = inject(LangGraphThreadsAdapter);
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

    // Persist and refresh whenever the active thread changes (e.g. after
    // create or switch) so bare mode routes can restore the current thread
    // and the panel stays up to date.
    effect(() => {
      const id = this.threadIdSignal();
      this.persistence.write('threadId', id);
      void this.threadsSvc.refresh();
    });

    // URL → signal. Explicit URL thread ids win (paste link, back/forward,
    // programmatic navigation). Bare mode URLs fall back to the persisted
    // active thread, which keeps conversations attached across mode routes.
    // The compare-and-set guard breaks the obvious URL→signal→URL loop:
    // by the time the signal→URL effect below fires, both values match
    // and `router.navigate` is skipped.
    effect(() => {
      const urlId = this.urlThreadId();
      const nextId = urlId ?? untracked(() => this.persistence.read('threadId') ?? null);
      const currentId = untracked(() => this.threadIdSignal());
      if (nextId !== currentId) {
        this.threadIdSignal.set(nextId);
      }
    });

    // Validate URL thread ids whenever they appear. Decoupled from the
    // sync effect above: on initial load the signal is hydrated from
    // the URL synchronously (field initializer), so the sync guard
    // would skip validation. This effect runs once per distinct id,
    // including the initial one. Cache last-validated to avoid
    // re-hitting the server on signal flips that round-trip the same
    // id back through.
    let lastValidated: string | null = null;
    effect(() => {
      const urlId = this.urlThreadId();
      if (urlId && urlId !== lastValidated) {
        lastValidated = urlId;
        void this.validateUrlThreadId(urlId);
      }
    });

    // signal → URL. When the agent auto-creates a thread, the sidenav
    // switches threads, or onNewThread fires, push the new id into the
    // URL. Skips when the URL already matches (also breaks the loop).
    effect(() => {
      const sigId = this.threadIdSignal();
      const { mode, threadId: urlId } = this.urlState();
      if (sigId === urlId) return;
      const cmds: unknown[] = sigId ? ['/', mode, sigId] : ['/', mode];
      void this.router.navigate(cmds as string[]);
    });

    // Refresh threads list when an agent run completes. The backend writes
    // metadata.title on the first user message via _maybe_write_thread_title;
    // a refresh after run-end picks up the new title in the drawer without
    // needing a manual thread switch or reload.
    refreshOnRunEnd(this.agent, () => this.threadsSvc.refresh());

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

  /** Parsed URL — single source for both the active mode AND the URL's
   *  thread id. Refreshes on every NavigationEnd so back/forward and
   *  programmatic navigations both feed downstream effects. */
  private readonly urlState = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => parseUrl(e.urlAfterRedirects)),
      startWith(parseUrl(this.router.url)),
      takeUntilDestroyed(),
    ),
    { initialValue: parseUrl(this.router.url) },
  );

  protected readonly mode = computed<DemoMode>(() => this.urlState().mode);
  private readonly urlThreadId = computed<string | null>(() => this.urlState().threadId);

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

  /** Whether the threads drawer is open. Always starts closed on a fresh
   *  load — drawer mode is a transient UI state, not a persisted preference. */
  protected readonly drawerOpen = signal<boolean>(false);

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
   * Below 768px the shell ignores this and forces drawer mode.
   */
  private readonly storedDesktopMode = signal<'expanded' | 'collapsed'>(
    (this.persistence.read('sidenavMode') as 'expanded' | 'collapsed' | null) ?? 'expanded',
  );

  /** Computed sidenav mode: viewport forces drawer below 768px, else user preference. */
  protected readonly sidenavMode = computed<ChatSidenavMode>(() =>
    this.viewportWidth() >= 768 ? this.storedDesktopMode() : 'drawer',
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

  /** Active thread id. URL is the source of truth when it contains an
   *  explicit thread id; bare mode URLs fall back to the last active
   *  thread so mode switches like `/embed` -> `/popup` preserve context. */
  protected readonly threadIdSignal = signal<string | null>(
    parseUrl(this.router.url).threadId ?? this.persistence.read('threadId') ?? null,
  );

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
      if (this.threadIdSignal() === id) this.threadIdSignal.set(null);
    },
    rename: (id, title) => this.threadsSvc.rename(id, title),
    archive: async (id) => {
      await this.threadsSvc.archive(id);
      if (this.threadIdSignal() === id) this.threadIdSignal.set(null);
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
        // The signal→URL effect picks this up and stamps the new id
        // into the URL — no persistence write needed any more, URL is
        // the source of truth.
        this.threadIdSignal.set(id);
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
    // Preserve the active thread across mode switches: /embed/abc →
    // /popup/abc keeps the conversation visible in the new chrome.
    const id = this.threadIdSignal();
    void this.router.navigate(id ? ['/', next, id] : ['/', next]);
  }

  /** Silently redirect to the bare mode path when the URL's threadId
   *  resolves to a 404. Uses `replaceUrl: true` so the back button
   *  doesn't reload the broken link. Non-404 errors propagate from
   *  the adapter as-is (genuine transport failures shouldn't be
   *  swallowed). */
  private async validateUrlThreadId(threadId: string): Promise<void> {
    const thread = await this.threadsSvc.getThread(threadId);
    if (thread) return;
    if (this.threadIdSignal() === threadId) {
      this.threadIdSignal.set(null);
      this.persistence.write('threadId', null);
    }
    await this.router.navigate(['/', this.mode()], { replaceUrl: true });
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

  /** Switch to an existing thread selected from the threads panel. */
  protected onThreadSelected(threadId: string): void {
    this.threadIdSignal.set(threadId);
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
    const id = await this.threadsSvc.create(sel ? { projectId: sel } : {});
    if (id) this.threadIdSignal.set(id);
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
