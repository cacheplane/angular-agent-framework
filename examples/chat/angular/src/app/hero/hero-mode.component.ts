// SPDX-License-Identifier: MIT
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  EnvironmentInjector,
  afterNextRender,
  computed,
  createEnvironmentInjector,
  inject,
  signal,
  type Provider,
} from '@angular/core';
import {
  ChatComponent,
  ChatInterruptPanelComponent,
  a2uiBasicCatalog,
  type Agent,
  type AgentRef,
  type InterruptAction,
} from '@threadplane/chat';
import {
  FetchStreamTransport,
  injectAgent,
  provideAgent,
  type AgentConfig,
  type LangGraphAgent,
} from '@threadplane/langgraph';
import { environment } from '../../environments/environment';
import { WelcomeSuggestionsComponent } from '../modes/welcome-suggestions.component';
import { HERO_LIVE_REF, HERO_REPLAY_REF } from './hero-agent-refs';
import { browserHeroBridge, type HeroBridge } from './hero-bridge';
import { HeroCursorComponent } from './hero-cursor.component';
import { HeroRecordingTransport } from './hero-recording.transport';
import { HeroReplayTransport } from './hero-replay.transport';
import { HeroScriptRunner, type CursorTarget, type HeroScriptHost } from './hero-script';

export type HeroModeKind = 'replay' | 'live';
const TYPE_DELAY_MS = 40;
const liveThreadId = signal<string | null>(null);

function isRecordMode(): boolean {
  if (environment.production || typeof location === 'undefined') return false;
  return new URLSearchParams(location.search).get('record') === '1';
}

/**
 * `provideAgent()` registers the shared AGENT token and aliases the ref to it,
 * so two calls in ONE providers array collapse into a single agent (last one
 * wins). The hero needs two live-at-once agents, so each gets its own child
 * environment injector holding exactly one `provideAgent()`.
 */
function scopedAgent(ref: AgentRef<Record<string, unknown>>, config: AgentConfig): LangGraphAgent {
  const injector = createEnvironmentInjector(provideAgent(ref, config), inject(EnvironmentInjector));
  inject(DestroyRef).onDestroy(() => injector.destroy());
  return injector.get(ref.token) as LangGraphAgent;
}

function heroProviders(replay: HeroReplayTransport = new HeroReplayTransport()): Provider[] {
  return [
    { provide: HeroReplayTransport, useValue: replay },
    {
      provide: HERO_REPLAY_REF.token,
      useFactory: () =>
        scopedAgent(HERO_REPLAY_REF, {
          assistantId: 'hero-replay',
          transport: inject(HeroReplayTransport),
        }),
    },
    {
      provide: HERO_LIVE_REF.token,
      useFactory: () =>
        scopedAgent(HERO_LIVE_REF, {
          apiUrl: environment.langGraphApiUrl,
          assistantId: environment.assistantId,
          threadId: liveThreadId,
          onThreadId: (id: string) => liveThreadId.set(id),
          transport: isRecordMode()
            ? new HeroRecordingTransport(
                new FetchStreamTransport(environment.langGraphApiUrl, (id) => liveThreadId.set(id)),
              )
            : undefined,
        }),
    },
  ];
}

@Component({
  selector: 'hero-mode',
  standalone: true,
  imports: [ChatComponent, ChatInterruptPanelComponent, WelcomeSuggestionsComponent, HeroCursorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: heroProviders(),
  template: `
    <div class="hero" [attr.data-mode]="mode()">
      <div class="hero__bar">
        <span class="hero__url">demo.threadplane.ai</span>
        <span class="hero__pill" data-hero-pill [attr.data-live]="mode() === 'live'">
          <span class="hero__dot" aria-hidden="true"></span>
          @if (mode() === 'live') {
            Live · LangGraph · new thread
          } @else {
            Replaying a recorded LangGraph run
          }
        </span>
      </div>
      <div class="hero__surface" data-hero-surface (pointerdown)="takeControl()" (focusin)="takeControl()">
        @if (mode() === 'live') {
          <p class="hero__banner" data-hero-banner role="status">
            You are live on a new LangGraph thread. The walkthrough was a recording.
            <button type="button" class="hero__link" data-hero-replay (click)="replay($event)">
              Replay walkthrough
            </button>
          </p>
        }
        @if (hasInterrupt()) {
          <div class="hero__interrupt" role="region" aria-label="Approval required">
            <chat-interrupt-panel [agent]="activeAgent()" (action)="onInterruptAction($event)" />
          </div>
        }
        <chat [agent]="activeAgent()" [views]="catalog">
          @if (mode() === 'live') {
            <welcome-suggestions chatWelcomeSuggestions (selected)="sendLive($event)" />
          }
        </chat>
        <hero-cursor [x]="cursorX()" [y]="cursorY()" [visible]="cursorVisible()" [pressed]="cursorPressed()" />
      </div>
      @if (mode() === 'replay') {
        <button type="button" class="hero__take" data-hero-take-control (click)="takeControl()">
          Take control ↗
        </button>
      }
    </div>
  `,
  styles: [
    `
      :host { display: block; height: 100%; }
      .hero { position: relative; display: flex; flex-direction: column; height: 100%; }
      .hero__bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 6px 12px; font: 12px/1.3 system-ui, sans-serif; border-bottom: 1px solid rgba(128,128,128,.25); }
      .hero__url { opacity: .6; }
      .hero__pill { display: inline-flex; align-items: center; gap: 6px; padding: 2px 9px; border-radius: 999px; border: 1px solid #b5731a; color: #b5731a; }
      .hero__pill[data-live='true'] { border-color: #2f6f4f; color: #2f6f4f; }
      .hero__dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
      .hero__surface { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; }
      .hero__surface > chat { flex: 1; min-height: 0; }
      .hero__interrupt { padding: 8px 12px 0; }
      .hero__banner { margin: 0; padding: 8px 12px; font: 13px/1.4 system-ui, sans-serif; background: rgba(47,111,79,.08); border-bottom: 1px solid rgba(47,111,79,.3); }
      .hero__link { margin-left: 8px; background: none; border: 0; padding: 0; color: inherit; text-decoration: underline; cursor: pointer; font: inherit; }
      .hero__take { position: absolute; left: 50%; bottom: 72px; transform: translateX(-50%); z-index: 10; padding: 8px 14px; border-radius: 999px; border: 0; background: #111; color: #fff; font: 600 13px/1 system-ui, sans-serif; cursor: pointer; box-shadow: 0 6px 18px rgba(0,0,0,.25); }
      .hero__take:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
    `,
  ],
})
export class HeroMode implements HeroScriptHost {
  /** The spec substitutes a preloaded replay transport through this. */
  static providersForTest(replay?: HeroReplayTransport): Provider[] {
    return heroProviders(replay);
  }

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly replayTransport = inject(HeroReplayTransport);
  private readonly replayAgent = injectAgent(HERO_REPLAY_REF) as LangGraphAgent;
  private readonly liveAgent = injectAgent(HERO_LIVE_REF) as LangGraphAgent;

  readonly mode = signal<HeroModeKind>(isRecordMode() ? 'live' : 'replay');
  readonly activeAgent = computed<Agent>(() => (this.mode() === 'live' ? this.liveAgent : this.replayAgent));
  protected readonly catalog = a2uiBasicCatalog();
  readonly cursorX = signal(0);
  readonly cursorY = signal(0);
  readonly cursorVisible = signal(false);
  readonly cursorPressed = signal(false);

  /** Replaced by the spec; browser bridge by default. */
  bridge: HeroBridge =
    typeof window === 'undefined'
      ? { postState: () => undefined, onVisibility: () => () => undefined }
      : browserHeroBridge();
  readonly reducedMotion =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  private runner: HeroScriptRunner | null = null;
  private visible = false;

  constructor() {
    afterNextRender(() => void this.boot());
    this.destroyRef.onDestroy(() => this.runner?.stop());
  }

  private async boot(): Promise<void> {
    const off = this.bridge.onVisibility((v) => this.setVisible(v));
    this.destroyRef.onDestroy(off);
    const onDocVis = () => this.setVisible(this.visible && !document.hidden);
    document.addEventListener('visibilitychange', onDocVis);
    this.destroyRef.onDestroy(() => document.removeEventListener('visibilitychange', onDocVis));
    try {
      await this.replayTransport.ready();
    } catch (err) {
      console.error('hero recording unavailable; staying live', err);
      this.mode.set('live');
      this.bridge.postState('ready');
      return;
    }
    this.bridge.postState('ready');
    // Opened directly (or in record mode): no embedder will drive visibility.
    if (window.parent === window) this.setVisible(true);
    this.startRunner();
  }

  private startRunner(): void {
    this.runner?.stop();
    this.runner = new HeroScriptRunner(this);
    this.runner.setVisible(this.visible);
    this.bridge.postState('scripted');
    void this.runner.loop();
  }

  private setVisible(v: boolean): void {
    this.visible = v;
    this.runner?.setVisible(v);
    if (this.mode() === 'replay' && this.runner) this.bridge.postState(v ? 'scripted' : 'paused');
  }

  takeControl(): void {
    if (this.mode() === 'live') return;
    this.runner?.stop();
    this.runner = null;
    this.cursorVisible.set(false);
    this.mode.set('live');
    this.bridge.postState('live');
  }

  replay(event?: Event): void {
    event?.stopPropagation();
    this.mode.set('replay');
    this.bridge.postState('replay');
    void this.restartReplay().then(() => this.startRunner());
  }

  protected sendLive(text: string): void {
    void this.liveAgent.submit({ message: text });
  }

  protected async onInterruptAction(action: InterruptAction): Promise<void> {
    const agent = this.activeAgent();
    if (!agent.interrupt?.()) return;
    const resume = action === 'ignore' ? 'denied' : 'approved';
    await agent.submit(null as never, { command: { resume } } as never);
  }

  // HeroScriptHost
  async typeInto(text: string): Promise<void> {
    const ta = this.textarea();
    if (!ta) return;
    const set = (value: string) => {
      ta.value = value;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    };
    if (this.reducedMotion) {
      set(text);
      return;
    }
    for (let i = 1; i <= text.length; i++) {
      set(text.slice(0, i));
      await sleep(TYPE_DELAY_MS);
    }
  }

  async send(): Promise<void> {
    await this.press(this.sendButton());
  }

  async acceptInterrupt(): Promise<void> {
    await this.press(this.acceptButton());
  }

  async moveCursor(target: CursorTarget): Promise<void> {
    const el =
      target === 'composer' ? this.textarea() : target === 'send' ? this.sendButton() : this.acceptButton();
    if (!el) return;
    const surface = this.surface().getBoundingClientRect();
    const r = el.getBoundingClientRect();
    this.cursorX.set(Math.round(r.left - surface.left + Math.min(r.width / 2, 40)));
    this.cursorY.set(Math.round(r.top - surface.top + r.height / 2));
    this.cursorVisible.set(true);
    await sleep(this.reducedMotion ? 0 : 650);
  }

  hasInterrupt(): boolean {
    return !!this.activeAgent().interrupt?.();
  }

  isRunning(): boolean {
    return this.activeAgent().isLoading();
  }

  async restartReplay(): Promise<void> {
    this.replayTransport.reset();
    this.replayAgent.switchThread(null);
  }

  private surface(): HTMLElement {
    return this.host.nativeElement.querySelector('[data-hero-surface]') as HTMLElement;
  }
  private textarea(): HTMLTextAreaElement | null {
    return this.surface().querySelector('textarea[aria-label="Type a message"]');
  }
  private sendButton(): HTMLButtonElement | null {
    return this.surface().querySelector('button[aria-label="Send message"]');
  }
  private acceptButton(): HTMLButtonElement | null {
    const buttons = Array.from(this.surface().querySelectorAll<HTMLButtonElement>('chat-interrupt-panel button'));
    return buttons.find((b) => /accept/i.test(b.textContent ?? '')) ?? null;
  }
  private async press(el: HTMLButtonElement | null): Promise<void> {
    if (!el) return;
    this.cursorPressed.set(true);
    await sleep(this.reducedMotion ? 0 : 120);
    el.click();
    this.cursorPressed.set(false);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
