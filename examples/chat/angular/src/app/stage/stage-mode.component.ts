import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EnvironmentInjector,
  InjectionToken,
  afterNextRender,
  createEnvironmentInjector,
  effect,
  inject,
  signal,
  type Provider,
  type WritableSignal,
} from '@angular/core';
import {
  ChatComponent,
  ChatInterruptPanelComponent,
  createAgentRef,
  type AgentRef,
  type InterruptAction,
} from '@threadplane/chat';
import { ChatDebugComponent } from '@threadplane/chat/debug';
import {
  FetchStreamTransport,
  injectAgent,
  provideAgent,
  type AgentConfig,
  type LangGraphAgent,
} from '@threadplane/langgraph';
import { environment } from '../../environments/environment';
import { demoViews } from '../demo-views';
import { browserStageBridge, type StageBridge, type StageState } from './stage-bridge';
import { StageController } from './stage-controller';
import { StageRecordingTransport } from './stage-recording.transport';
import { StageReplayTransport } from './stage-replay.transport';
import { StageScript, type StageScriptHost } from './stage-script';
import type { StageTimeline } from './stage-timeline';

declare global {
  interface Window {
    /** Published in replay mode so a still recorder can map scroll to time. */
    __stageTimeline?: StageTimeline;
    /** The applied state of the last settled seek; the still recorder waits on it. */
    __stageApplied?: StageState;
  }
}

/** The one stage agent: replay-backed normally, live + recording under `?record=1`. */
export const STAGE_REF = createAgentRef<Record<string, unknown>>('stage');

/** Held per component instance, not at module scope: a re-entered route starts clean. */
const STAGE_THREAD_ID = new InjectionToken<WritableSignal<string | null>>('STAGE_THREAD_ID');
/** The recording transport in record mode; null in replay mode. */
const STAGE_RECORDING = new InjectionToken<StageRecordingTransport | null>('STAGE_RECORDING');

/**
 * Same filter the demo shell and the hero apply: the canonical graph has
 * side-effect LLM nodes (generate_title) whose tokens must not land on the
 * just-completed answer, which would trip the streaming-markdown contract and
 * stop the NEXT turn from rendering. The replay agent needs it too — the
 * recording carries the same events the live run did.
 */
const TRANSCRIPT_NODE_NAMES = ['generate'];

/** How long the record host waits to observe a submitted run actually starting. */
const RUN_START_CAP_MS = 2000;
/** How long the record host waits for a reload's history refresh to land. */
const RELOAD_CAP_MS = 10_000;
const POLL_MS = 50;

function isRecordMode(): boolean {
  if (environment.production || typeof location === 'undefined') return false;
  return new URLSearchParams(location.search).get('record') === '1';
}

/**
 * `provideAgent()` registers the shared AGENT token and aliases the ref to it,
 * so two calls in ONE providers array collapse into a single agent. One child
 * environment injector per agent keeps that from biting if the stage ever
 * grows a second one.
 */
function scopedAgent(ref: AgentRef<Record<string, unknown>>, config: AgentConfig): LangGraphAgent {
  const injector = createEnvironmentInjector(provideAgent(ref, config), inject(EnvironmentInjector));
  inject(DestroyRef).onDestroy(() => injector.destroy());
  return injector.get(ref.token) as LangGraphAgent;
}

function stageProviders(replay?: StageReplayTransport): Provider[] {
  return [
    // useFactory, not useValue: this array is built once at decorator time, so
    // a `new StageReplayTransport()` here would be a module singleton carrying
    // its run index across route re-entries.
    { provide: StageReplayTransport, useFactory: () => replay ?? new StageReplayTransport() },
    { provide: STAGE_THREAD_ID, useFactory: () => signal<string | null>(null) },
    {
      provide: STAGE_RECORDING,
      useFactory: () => {
        if (!isRecordMode()) return null;
        const threadId = inject(STAGE_THREAD_ID);
        let rec: StageRecordingTransport | null = null;
        const inner = new FetchStreamTransport(environment.langGraphApiUrl, (id: string) => {
          threadId.set(id);
          rec?.onThreadId(id);
        });
        rec = new StageRecordingTransport(inner);
        return rec;
      },
    },
    {
      provide: STAGE_REF.token,
      useFactory: () => {
        const threadId = inject(STAGE_THREAD_ID);
        const recording = inject(STAGE_RECORDING);
        if (recording) {
          return scopedAgent(STAGE_REF, {
            apiUrl: environment.langGraphApiUrl,
            assistantId: environment.assistantId,
            threadId,
            onThreadId: (id: string) => threadId.set(id),
            transport: recording,
            transcriptNodeNames: TRANSCRIPT_NODE_NAMES,
          });
        }
        return scopedAgent(STAGE_REF, {
          assistantId: 'stage-replay',
          threadId,
          transport: inject(StageReplayTransport),
          transcriptNodeNames: TRANSCRIPT_NODE_NAMES,
        });
      },
    },
  ];
}

@Component({
  selector: 'stage-mode',
  standalone: true,
  imports: [ChatComponent, ChatInterruptPanelComponent, ChatDebugComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: stageProviders(),
  template: `
    <div class="stage">
      <div class="stage__bar">
        <span class="stage__url">demo.threadplane.ai</span>
        <span class="stage__pill" data-stage-pill [attr.data-live]="recording !== null">
          <span class="stage__dot" aria-hidden="true"></span>
          @if (recording !== null) {
            Recording a live LangGraph run
          } @else {
            Replaying a recorded LangGraph run
          }
        </span>
        <a class="stage__open" href="/embed" target="_top">Open the live demo ↗</a>
      </div>
      <div class="stage__surface">
        <div class="stage__column">
          <div
            class="stage__interrupt"
            data-stage-interrupt
            [attr.data-inert]="recording === null"
            role="region"
            aria-label="Approval required"
          >
            @if (agent.interrupt?.()) {
              <chat-interrupt-panel [agent]="agent" (action)="onInterruptAction($event)" />
            }
          </div>
          <chat [agent]="agent" [views]="catalog"></chat>
        </div>
        <chat-debug
          [agent]="debugAgent"
          dock="right"
          [defaultOpen]="true"
          launcher="none"
          storageKey="stage-debug"
        />
      </div>
    </div>
  `,
  styles: [
    `
      :host { display: block; height: 100%; }
      .stage { display: flex; flex-direction: column; height: 100%; }
      .stage__bar { display: flex; align-items: center; gap: 12px; padding: 6px 12px; font: 12px/1.3 system-ui, sans-serif; border-bottom: 1px solid rgba(128,128,128,.25); }
      .stage__url { opacity: .6; }
      .stage__pill { display: inline-flex; align-items: center; gap: 6px; padding: 2px 9px; border-radius: 999px; border: 1px solid #b5731a; color: #b5731a; }
      .stage__pill[data-live='true'] { border-color: #2f6f4f; color: #2f6f4f; }
      .stage__dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
      .stage__open { margin-left: auto; color: inherit; opacity: .7; }
      .stage__surface { position: relative; flex: 1; min-height: 0; display: flex; }
      /* chat-debug's right dock is position: fixed at width: var(--panel-size, 420px)
         (libs/chat/debug/.../chat-debug.component.ts, .panel--right), so it is out of
         flow and would sit ON TOP of the transcript. 420 + 16 gutter = 436px. */
      .stage__column { flex: 1; min-width: 0; display: flex; flex-direction: column; padding-right: var(--stage-devtools-width, 436px); }
      .stage__column > chat { flex: 1; min-height: 0; }
      .stage__interrupt:empty { display: none; }
      .stage__interrupt { padding: 8px 12px 0; }
      /* Replay is a recording, not a control surface: the panel is shown but
         cannot be clicked, so a visitor cannot desync the transcript from t. */
      .stage__interrupt[data-inert='true'] { pointer-events: none; }
    `,
  ],
})
export class StageMode {
  /** TEST SEAM. Substitutes a preloaded replay transport so no fetch is made. */
  static providersForTest(replay?: StageReplayTransport): Provider[] {
    return stageProviders(replay);
  }

  /** TEST SEAM. Markup specs must not boot a replay on real timers. */
  static autoBoot = true;
  static disableAutoBootForTests(): void {
    StageMode.autoBoot = false;
  }
  static enableAutoBoot(): void {
    StageMode.autoBoot = true;
  }

  private readonly destroyRef = inject(DestroyRef);
  private readonly replayTransport = inject(StageReplayTransport);
  private readonly threadId = inject(STAGE_THREAD_ID);
  /** Non-null only in record mode. */
  protected readonly recording = inject(STAGE_RECORDING);
  protected readonly agent = injectAgent(STAGE_REF) as LangGraphAgent;
  /**
   * The devtools' agent contract types `state` as `Signal<Record<string,
   * unknown>>` while the untyped LangGraph agent exposes `Signal<unknown>`, so
   * the SAME object needs a cast at this one read site.
   */
  protected readonly debugAgent = this.agent as unknown as NonNullable<
    ReturnType<ChatDebugComponent['agent']>
  >;
  protected readonly catalog = demoViews();

  readonly timeline = signal<StageTimeline | null>(null);
  readonly controller = signal<StageController | null>(null);

  /** TEST SEAM. Replaced by the spec; browser bridge by default. */
  bridge: StageBridge =
    typeof window === 'undefined'
      ? { onSeek: () => () => undefined, postReady: () => undefined, postState: () => undefined }
      : browserStageBridge();

  private lastPosted = '';
  private seekTarget: number | null = null;
  private seekFrame: number | null = null;

  constructor() {
    afterNextRender(() => {
      if (StageMode.autoBoot) {
        void this.boot(new URLSearchParams(typeof location === 'undefined' ? '' : location.search));
      }
    });
    effect(() => {
      const c = this.controller();
      if (!c) return;
      this.publish({ applied: c.applied(), phase: c.phase(), t: c.t() });
    });
  }

  /** Public so a spec (or the still recorder's harness) can boot explicitly. */
  async boot(params: URLSearchParams): Promise<void> {
    try {
      if (this.recording) {
        await this.record();
        return;
      }
      const tl = await this.replayTransport.ready();
      this.timeline.set(tl);
      if (typeof window !== 'undefined') window.__stageTimeline = tl;
      const controller = new StageController(
        this.agent,
        this.replayTransport,
        tl,
        await this.replayTransport.recordingData(),
      );
      this.controller.set(controller);
      this.bridge.postReady({ totalMs: tl.totalMs, beats: tl.beats });
      const off = this.bridge.onSeek((t) => this.requestSeek(t));
      this.destroyRef.onDestroy(off);
      await controller.seek(Number(params.get('t')) || 0);
      // Published here as well as from the effect: `await boot()` must imply
      // the applied state is observable, without waiting on a render pass.
      this.publish({ applied: controller.applied(), phase: controller.phase(), t: controller.t() });
    } catch (err) {
      console.error('[stage] boot failed', err);
    }
  }

  /**
   * One `controller.seek()` per animation frame, last target wins: a scroll
   * burst posts far more targets than the agent's non-re-entrant submit path
   * can absorb.
   */
  requestSeek(t: number): void {
    this.seekTarget = t;
    if (typeof requestAnimationFrame !== 'function') {
      void this.controller()?.seek(t);
      return;
    }
    if (this.seekFrame !== null) return;
    this.seekFrame = requestAnimationFrame(() => {
      this.seekFrame = null;
      const target = this.seekTarget;
      this.seekTarget = null;
      if (target !== null) void this.controller()?.seek(target);
    });
  }

  protected async onInterruptAction(action: InterruptAction): Promise<void> {
    // Replay's interrupt panel is inert; only the recorder resolves for real.
    if (!this.recording) return;
    await this.agent.submit(null, {
      command: { resume: action === 'accept' ? 'approved' : 'denied' },
    } as never);
  }

  private publish(state: StageState): void {
    const key = `${state.applied}|${state.phase}|${state.t}`;
    if (key === this.lastPosted) return;
    this.lastPosted = key;
    this.bridge.postState(state);
    if (typeof window !== 'undefined') window.__stageApplied = state;
  }

  // ── Record mode ───────────────────────────────────────────────────────────

  /** Drives the four beats against the LIVE agent, producing the recording. */
  private async record(): Promise<void> {
    const rec = this.recording;
    if (!rec) return;
    const agent = this.agent;
    const host: StageScriptHost = {
      beginRun: (beat, action) => rec.beginRun(beat, action),
      submit: async (message, checkpointIndex) => {
        const checkpointId =
          checkpointIndex !== undefined ? agent.history()[checkpointIndex]?.id : undefined;
        void agent.submit({ message }, checkpointId ? ({ checkpointId } as never) : undefined);
        await waitUntil(() => agent.isLoading(), RUN_START_CAP_MS);
      },
      resume: async (value) => {
        void agent.submit(null, { command: { resume: value } } as never);
        await waitUntil(() => agent.isLoading(), RUN_START_CAP_MS);
      },
      reload: async () => {
        // The reload's snapshot is stamped with the run count at the moment
        // markReload() fires, so it MUST wait for the adoption's history
        // refresh: closing the run first stamps an index the replay's
        // getHistory() (which keys on runIndex) can never serve.
        const before = rec.recording().histories.length;
        const id = this.threadId();
        agent.switchThread(null);
        agent.switchThread(id);
        await waitUntil(
          () => !agent.isThreadLoading() && rec.recording().histories.length > before,
          RELOAD_CAP_MS,
        );
        rec.markReload();
      },
      isRunning: () => agent.isLoading(),
      hasInterrupt: () => !!agent.interrupt?.(),
      forkIndex: () => {
        // history() is newest-first, so the first checkpoint holding exactly
        // the opening question + its answer is the fork point.
        const history = agent.history();
        const i = history.findIndex(
          (s) => ((s.values as { messages?: unknown[] } | undefined)?.messages?.length ?? 0) === 2,
        );
        return i >= 0 ? i : history.length - 1;
      },
      sleep,
    };
    await new StageScript(host).run();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Polls `pred` until true or the cap elapses; never throws, so a slow run still records. */
async function waitUntil(pred: () => boolean, capMs: number): Promise<void> {
  const deadline = Date.now() + capMs;
  while (!pred()) {
    if (Date.now() >= deadline) {
      console.warn('[stage] record host wait timed out');
      return;
    }
    await sleep(POLL_MS);
  }
}
