import { computed, signal, type Signal } from '@angular/core';
import type { LangGraphAgent } from '@threadplane/langgraph';
import type { StageRecording, StageRun } from './stage-recording.types';
import { phaseAt, runsStartedBy, type StagePhase, type StageTimeline } from './stage-timeline';
import type { StageReplayTransport } from './stage-replay.transport';

/**
 * The phase reported for a time is the phase of the moment the stage has
 * REACHED, not of the one about to begin: runs are laid end to end, so a run's
 * end is the next run's start, and at that instant the outgoing run still owns
 * the frame — the incoming one has not rendered anything yet.
 */
const PHASE_EPSILON = 1e-3;
/** Ceiling on how long a settle waits for the agent to go idle before moving on. */
const SETTLE_TIMEOUT_MS = 2000;

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
 */
export class StageController {
  private performed = -1;
  private target = 0;
  private inFlight: Promise<void> | null = null;
  private pending: number | null = null;
  private readonly tSig = signal(0);
  readonly phase = computed<StagePhase>(() =>
    phaseAt(this.timeline, Math.max(0, this.tSig() - PHASE_EPSILON)),
  );
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
    if (this.inFlight) {
      this.pending = clamped;
      return this.inFlight;
    }
    this.inFlight = this.run(clamped).finally(() => {
      this.inFlight = null;
      if (this.pending !== null) {
        const next = this.pending;
        this.pending = null;
        void this.seek(next);
      }
    });
    return this.inFlight;
  }

  private async run(t: number): Promise<void> {
    if (t < this.target) this.reset();
    this.target = t;
    this.tSig.set(t);
    if (this.performed < 0) {
      this.agent.switchThread(this.recording.threadId);
      await this.settle();
    }
    for (const entry of runsStartedBy(this.timeline, t)) {
      if (entry.index <= this.performed) continue;
      this.performed = entry.index;
      // Drain the previous run to this run's start before acting: the agent's
      // submit path aborts whatever stream is open, so acting early would
      // truncate the run being replaced.
      this.transport.seek(entry.startMs);
      await this.settle();
      this.perform(entry.run);
    }
    this.transport.seek(t);
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
        const checkpointId =
          action.checkpointIndex !== undefined
            ? this.agent.history()[action.checkpointIndex]?.id
            : undefined;
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

  /** Waits for the agent to go idle, so the next action starts from a settled transcript. */
  private async settle(): Promise<void> {
    const deadline = Date.now() + SETTLE_TIMEOUT_MS;
    while (this.agent.isLoading() || this.agent.isThreadLoading()) {
      if (Date.now() > deadline) return;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
}
