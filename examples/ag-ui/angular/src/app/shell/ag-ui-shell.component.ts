// SPDX-License-Identifier: MIT
import {
  Component,
  ChangeDetectionStrategy,
  DOCUMENT,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { injectAgent } from '@threadplane/ag-ui';
import {
  ChatInterruptPanelComponent,
  ChatSelectComponent,
  type InterruptAction,
} from '@threadplane/chat';
import { PalettePersistence } from './palette-persistence.service';
import { ItineraryPanelComponent } from '../itinerary-panel.component';
import { itineraryClientTools, ITINERARY_AGENT } from '../client-tools';

export type DemoMode = 'embed' | 'popup' | 'sidebar';
const MODES: readonly DemoMode[] = ['embed', 'popup', 'sidebar'] as const;

/** Default knob values — omitted from the URL when active. */
const DEFAULTS = {
  model: 'gpt-5-mini',
  effort: 'minimal',
  genui: 'a2ui',
  theme: 'default-dark',
  scheme: 'dark',
} as const;

@Component({
  selector: 'ag-ui-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, ChatSelectComponent, ChatInterruptPanelComponent, ItineraryPanelComponent],
  templateUrl: './ag-ui-shell.component.html',
  styleUrl: './ag-ui-shell.component.css',
  providers: [PalettePersistence],
})
export class AgUiShell {
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  protected readonly persistence = inject(PalettePersistence);

  // ── Knob signals: URL > localStorage > default ───────────────────────────
  private urlKnob(name: string): string | null {
    // AgUiShell is not a routed component so ActivatedRoute.snapshot may not
    // carry query params at initialization time. Read from window.location.search
    // (the real browser URL) which is available immediately at bootstrap.
    const win = this.document.defaultView;
    const search = win?.location.search ?? '';
    const v = new URLSearchParams(search).get(name);
    return v && v.length > 0 ? v : null;
  }

  readonly model = signal<string>(this.urlKnob('model') ?? this.persistence.read('model') ?? DEFAULTS.model);
  readonly effort = signal<string>(this.urlKnob('effort') ?? this.persistence.read('effort') ?? DEFAULTS.effort);
  readonly genUiMode = signal<string>(this.urlKnob('genui') ?? this.persistence.read('genUiMode') ?? DEFAULTS.genui);
  readonly theme = signal<string>(this.urlKnob('theme') ?? this.persistence.read('theme') ?? DEFAULTS.theme);
  readonly colorScheme = signal<'light' | 'dark'>(
    ((this.urlKnob('scheme') ?? this.persistence.read('colorScheme')) as 'light' | 'dark' | null) ?? DEFAULTS.scheme,
  );

  // ── Mode from the active route ───────────────────────────────────────────
  readonly mode = signal<DemoMode>(this.parseMode(this.router.url));
  protected readonly modeOptions: readonly { value: DemoMode; label: string }[] = [
    { value: 'embed', label: 'Embed' },
    { value: 'popup', label: 'Popup' },
    { value: 'sidebar', label: 'Sidebar' },
  ];

  private parseMode(url: string): DemoMode {
    const seg = url.split('?')[0].split('/').filter(Boolean)[0];
    return (MODES as readonly string[]).includes(seg) ? (seg as DemoMode) : 'embed';
  }

  // ── Select options (canonical lists) ─────────────────────────────────────
  readonly modelOptions = signal<readonly { value: string; label: string }[]>([
    { value: 'gpt-5-mini', label: 'gpt-5-mini' },
    { value: 'gpt-5-nano', label: 'gpt-5-nano' },
  ]);
  protected readonly effortOptions = signal<readonly { value: string; label: string }[]>([
    { value: 'minimal', label: 'minimal (fast)' },
    { value: 'low', label: 'low' },
    { value: 'medium', label: 'medium' },
    { value: 'high', label: 'high (visible reasoning)' },
  ]);
  protected readonly genUiOptions = signal<readonly { value: string; label: string }[]>([
    { value: 'a2ui', label: 'A2UI' },
    { value: 'json-render', label: 'json-render' },
  ]);
  protected readonly themeOptions = signal<readonly { value: string; label: string }[]>([
    { value: 'default-dark', label: 'Default dark' },
    { value: 'default-light', label: 'Default light' },
    { value: 'material-dark', label: 'Material dark' },
    { value: 'material-light', label: 'Material light' },
  ]);

  // Frontend-declared client tools (itinerary get/add/move/clear + day_card).
  // Built in an injection context (field initializer) so itineraryClientTools()
  // can inject the shared ItineraryStore. Modes bind this to <chat [clientTools]>.
  readonly clientTools = itineraryClientTools();

  // ── Shared agent: submit wrapper merges the knobs into input.state ──────
  // injectAgent(ITINERARY_AGENT) returns AgUiAgent<ItineraryState>, so
  // a.submit's input type carries { state?: ItineraryState } — no cast needed
  // to spread the palette knobs into state.
  readonly agent = (() => {
    const a = injectAgent(ITINERARY_AGENT);
    const orig = a.submit.bind(a);
    (a as { submit: typeof a.submit }).submit = (async (
      input: Parameters<typeof a.submit>[0],
      opts?: Parameters<typeof a.submit>[1],
    ) => {
      return orig(
        {
          ...(input ?? {}),
          state: {
            ...(input?.state ?? {}),
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

  constructor() {
    // Routed mode components read the shared wrapped agent via
    // `inject(AgUiShell).agent` — no token needed.
    // Keep mode() in sync with navigation.
    this.router.events.subscribe(() => {
      const m = this.parseMode(this.router.url);
      if (m !== this.mode()) this.mode.set(m);
    });

    // Reflect theme + scheme onto <html> exactly like the canonical shell.
    effect(() => {
      const html = this.document.documentElement;
      html.setAttribute('data-theme', this.theme());
      const scheme = this.colorScheme();
      html.setAttribute('data-threadplane-chat-theme', scheme);
      html.setAttribute('data-color-scheme', scheme);
      const t = this.theme();
      if (t === 'default-dark' || t === 'default-light') {
        const next = scheme === 'light' ? 'default-light' : 'default-dark';
        if (next !== t) this.theme.set(next);
      }
    });

    // Persist + sync knobs to the URL (defaults omitted).
    effect(() => {
      const q: Record<string, string | null> = {
        model: this.model() === DEFAULTS.model ? null : this.model(),
        effort: this.effort() === DEFAULTS.effort ? null : this.effort(),
        genui: this.genUiMode() === DEFAULTS.genui ? null : this.genUiMode(),
        theme: this.theme() === DEFAULTS.theme ? null : this.theme(),
        scheme: this.colorScheme() === DEFAULTS.scheme ? null : this.colorScheme(),
      };
      void this.router.navigate([], { queryParams: q, queryParamsHandling: 'merge', replaceUrl: true });
    });
  }

  protected onModeChange(next: DemoMode | string): void {
    if (!(MODES as readonly string[]).includes(next as string)) return;
    void this.router.navigate(['/', next], { queryParamsHandling: 'preserve' });
  }
  onModelChange(v: string): void { this.model.set(v); this.persistence.write('model', v); }
  protected onEffortChange(v: string): void { this.effort.set(v); this.persistence.write('effort', v); }
  protected onGenUiModeChange(v: string): void { this.genUiMode.set(v); this.persistence.write('genUiMode', v); }
  protected onThemeChange(v: string): void { this.theme.set(v); this.persistence.write('theme', v); }
  protected onColorSchemeChange(v: 'light' | 'dark' | string): void {
    if (v !== 'light' && v !== 'dark') return;
    this.colorScheme.set(v);
    this.persistence.write('colorScheme', v);
  }

  /** Same four-action vocabulary as the canonical shell; resumes via
   *  AG-UI's submit({ resume }) path (forwardedProps.command.resume). */
  protected async onInterruptAction(action: InterruptAction): Promise<void> {
    const interrupt = this.agent.interrupt?.();
    if (!interrupt) return;
    let resume: unknown;
    switch (action) {
      case 'accept': resume = 'approved'; break;
      case 'edit': {
        const reason = (interrupt.value as { reason?: string })?.reason ?? '';
        const edited = window.prompt(`Edit your response (current proposal: "${reason}"):`, 'approved');
        if (edited == null) return;
        resume = edited; break;
      }
      case 'respond': {
        const text = window.prompt('Respond to the agent:', '');
        if (text == null) return;
        resume = text; break;
      }
      case 'ignore': resume = 'denied'; break;
    }
    await this.agent.submit({ resume });
  }
}
