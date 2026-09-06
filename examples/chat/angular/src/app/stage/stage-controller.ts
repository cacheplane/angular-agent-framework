import { computed, signal, type Signal } from '@angular/core';
import type { LangGraphAgent } from '@threadplane/langgraph';
import type { StageRecording, StageRun } from './stage-recording.types';
import { phaseReachedAt, runsStartedBy, type StagePhase, type StageTimeline, type TimelineRun } from './stage-timeline';
import type { StageReplayTransport } from './stage-replay.transport';

/**
 * BOUNDARY CONVENTION. Two different questions are asked about the same
 * instant, and they answer differently on purpose:
 *
 * - ACTIONS are performed INCLUSIVELY at a run's `startMs`. Reaching a run's
 *   start means that run's action has fired, so its first events (recorded at
 *   tMs 0) are ready at that same instant.
 * - `phase()` names the moment RENDERED, which is `t` minus an epsilon (see
 *   `phaseReachedAt`). Runs are laid end to end, so a run's end is the next
 *   run's start; at that instant the outgoing run still owns the frame.
 *
 * Consumers must therefore NOT infer which action has fired from `phase()`:
 * at a boundary `phase()` still names the outgoing run while the incoming
 * run's action has already been performed.
 */

/** Ceiling on how long a drain waits for the agent to go idle before moving on. */
const SETTLE_TIMEOUT_MS = 2000;
/** Ceiling on how long we wait to OBSERVE a performed run starting. */
const RUN_START_TIMEOUT_MS = 500;
/** Ceiling on how long a seek waits for the transport's events to be applied. */
const APPLY_TIMEOUT_MS = 2000;

/** One `seek()` caller, waiting for a pass that reaches its target. */
interface SeekWaiter {
  readonly target: number;
  readonly resolve: () => void;
}

/**
 * Drives the replay agent to any recorded time.
 *
 * Forward: for each run whose start has been crossed and not yet performed,
 * drain the previous run to that run's start, then perform this run's recorded
 * action (submit / resume / reload), and finally open the transport's gate to
 * `t`. Backward: reset the agent and the transport, then fast-forward. Seeks
 * are coalesced so a burst inside one frame performs each action once, and a
 * seek that arrives while one is in flight is applied after it, never
 * concurrently — the agent's submit path is not re-entrant.
 *
 * `seek(t)` resolves only once a pass has completed AND the events recorded at
 * or before its target have been applied, so `await seek(t)` implies the stage
 * is showing t. A target that is superseded by a later seek is never applied
 * on its own — it is coalesced into the last pass, and its waiters resolve
 * when that pass completes.
 */
export class StageController {
  private performed = -1;
  private target = 0;
  private inFlight: Promise<void> | null = null;
  private pending: number | null = null;
  private waiters: SeekWaiter[] = [];
  private readonly tSig = signal(0);
  readonly phase = computed<StagePhase>(() => phaseReachedAt(this.timeline, this.tSig()));
  /** Events the transport has yielded since the last reset. */
  readonly applied: Signal<number>;
  readonly t = this.tSig.asReadonly();

  constructor(
    private readonly agent: LangGraphAgent,
    private readonly transport: StageReplayTransport,
    private readonly timeline: StageTimeline,
    private readonly recording: StageRecording,
  ) {
    // Assigned here rather than in a field initializer: parameter properties
    // are not bound until the constructor body runs.
    this.applied = transport.appliedSignal;
  }

  seek(t: number): Promise<void> {
    const clamped = Math.max(0, Math.min(this.timeline.totalMs, t));
    const waited = new Promise<void>((resolve) => this.waiters.push({ target: clamped, resolve }));
    if (this.inFlight) this.pending = clamped;
    else this.dispatch(clamped);
    return waited;
  }

  private dispatch(t: number): void {
    this.inFlight = this.run(t)
      .catch((err: unknown) => console.warn('[stage] seek failed', err))
      .finally(() => {
        this.inFlight = null;
        const next = this.pending;
        this.pending = null;
        // A superseded target is never applied on its own: its waiters ride
        // the last pass, so they are only released once no pass is pending.
        if (next !== null) {
          this.dispatch(next);
          this.release((w) => w.target === t);
          return;
        }
        this.release(() => true);
      });
  }

  private release(match: (w: SeekWaiter) => boolean): void {
    const kept: SeekWaiter[] = [];
    for (const w of this.waiters) {
      if (match(w)) w.resolve();
      else kept.push(w);
    }
    this.waiters = kept;
  }

  private async run(t: number): Promise<void> {
    if (t < this.target) this.reset();
    this.target = t;
    this.tSig.set(t);
    if (this.performed < 0) {
      this.agent.switchThread(this.recording.threadId);
      await this.drain(-1);
    }
    for (const entry of runsStartedBy(this.timeline, t)) {
      if (entry.index <= this.performed) continue;
      // Drain the previous run to this run's start before acting: the agent's
      // submit path aborts whatever stream is open, so acting early would
      // truncate the run being replaced.
      this.transport.seek(entry.startMs);
      if (this.performed >= 0) await this.drain(this.performed);
      this.performed = entry.index;
      this.perform(entry.run);
      await this.observeStart(entry);
    }
    this.transport.seek(t);
    await this.awaitApplied(t);
  }

  private reset(): void {
    this.performed = -1;
    this.target = 0;
    this.agent.switchThread(null);
    this.transport.reset();
  }

  private perform(run: StageRun): void {
    const action = run.action;
    switch (action.kind) {
      case 'submit': {
        let checkpointId: string | undefined;
        if (action.checkpointIndex !== undefined) {
          checkpointId = this.agent.history()[action.checkpointIndex]?.id;
          if (!checkpointId) {
            console.warn('[stage] fork checkpoint missing', { checkpointIndex: action.checkpointIndex });
          }
        }
        void this.agent.submit(
          { message: action.message },
          checkpointId ? ({ checkpointId } as never) : undefined,
        );
        return;
      }
      case 'resume':
        void this.agent.submit(null, { command: { resume: action.value } } as never);
        return;
      case 'reload':
        // A simulated page reload: drop the thread (which aborts the open
        // stream and blanks the transcript), then re-adopt it so the bridge
        // restores it from the recorded history snapshot.
        this.agent.switchThread(null);
        this.agent.switchThread(this.recording.threadId);
        return;
    }
  }

  /**
   * Waits until a run we just performed has visibly STARTED — the agent
   * reports loading, or the transport yielded an event. Gating on an
   * observation rather than on a status read taken before the first await is
   * what makes the following drain meaningful: `submit()` is asynchronous, so
   * a pre-await read of `isLoading()` can still be false and let the drain
   * fall straight through. A reload has no stream to observe.
   */
  private async observeStart(entry: TimelineRun): Promise<void> {
    if (entry.run.action.kind === 'reload') return;
    const before = this.transport.applied();
    const deadline = Date.now() + RUN_START_TIMEOUT_MS;
    while (!this.agent.isLoading() && this.transport.applied() === before) {
      if (Date.now() > deadline) {
        console.warn('[stage] settle timed out', { run: entry.index });
        return;
      }
      await macrotask();
    }
  }

  /** Waits for the agent to go idle, so the next action starts from a settled transcript. */
  private async drain(runIndex: number): Promise<void> {
    const deadline = Date.now() + SETTLE_TIMEOUT_MS;
    while (this.agent.isLoading() || this.agent.isThreadLoading()) {
      if (Date.now() > deadline) {
        console.warn('[stage] settle timed out', { run: runIndex });
        return;
      }
      await macrotask();
    }
  }

  /**
   * Waits until every event recorded at or before `t` has been yielded by the
   * transport, and then for one quiet macrotask so the bridge has applied the
   * last of them. This is what lets `await seek(t)` imply "the stage shows t"
   * without the caller polling.
   */
  private async awaitApplied(t: number): Promise<void> {
    const expected = this.expectedApplied(t);
    const deadline = Date.now() + APPLY_TIMEOUT_MS;
    let previous = -1;
    for (;;) {
      const now = this.transport.applied();
      if (now >= expected && now === previous) return;
      if (Date.now() > deadline) {
        console.warn('[stage] apply timed out', { t, expected, applied: now });
        return;
      }
      previous = now;
      await macrotask();
    }
  }

  /** How many recorded events fall at or before t in absolute recorded time. */
  private expectedApplied(t: number): number {
    let n = 0;
    for (const r of this.timeline.runs) {
      for (const e of r.run.events) if (r.startMs + e.tMs <= t) n += 1;
    }
    return n;
  }
}

/** A macrotask tick: also flushes the microtasks the bridge applies events on. */
function macrotask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
