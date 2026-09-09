import type { StageAction, StageBeat } from './stage-recording.types';

/**
 * One operational story across five beats. These prompts produce a real run;
 * the recorded prose is never edited after capture.
 */
export const STAGE_PROMPTS = {
  stream:
    'Review our demo backup retention policy. Summarize the windows and safeguards in three short bullets with citations. Policy review only; no actions yet.',
  subagents: 'Before calling research, tell me you are delegating. Have the subagent compare 90 and 120 days using our policy, in three short bullets. Then recommend a window. No actions yet.',
  proposal: 'Using the policy and research we saved, summarize the original 90-day proposal in two sentences. Planning only; no actions yet.',
  fork: 'Explore a conservative alternative: keep 120 days instead. Use our saved policy and research, and explain the tradeoff in two sentences. Planning only; no actions yet.',
  approve: 'Proceed with the 120-day cleanup. List the eligible backups and preserve every retained backup. Call delete_backups for the eligible IDs; its built-in approval pause is my review step.',
  render: 'Show a compact cleanup report: the actual deleted count, freed GB, remaining count, and 120-day window. Note that retained backups were preserved. Add an editable, multiline Follow-up notes text field and initialize its bound data-model value to an empty string. Keep everything on one screen.',
} as const;

export interface StageScriptHost {
  beginRun(beat: StageBeat, action: StageAction): void;
  /**
   * Resolves once the run has CLOSED and its closing history refresh has
   * landed. Resolving any earlier lets the script start the next run while
   * the refresh is in flight, which cancels it and leaves this run without a
   * history snapshot for the replay to serve.
   */
  submit(message: string, checkpointIndex?: number): Promise<void>;
  /** Same contract as `submit`. */
  resume(value: string): Promise<void>;
  reload(): Promise<void>;
  isRunning(): boolean;
  hasInterrupt(): boolean;
  /** Index into history() of the completed research checkpoint to fork from. */
  forkIndex(): number;
  sleep(ms: number): Promise<void>;
}

export const SCRIPT_WAIT_TIMEOUT_MS = 120_000;
const POLL_MS = 50;

/** Record-mode driver: performs the beats against the live agent, announcing each run first. */
export class StageScript {
  constructor(private readonly host: StageScriptHost) {}

  async run(): Promise<void> {
    await this.turn('stream', STAGE_PROMPTS.stream);
    await this.turn('subagents', STAGE_PROMPTS.subagents);

    this.host.beginRun('persist', { kind: 'reload' });
    await this.host.reload();

    await this.turn('persist', STAGE_PROMPTS.proposal);

    const fork = this.host.forkIndex();
    await this.turn('persist', STAGE_PROMPTS.fork, fork);

    this.host.beginRun('approve', { kind: 'submit', message: STAGE_PROMPTS.approve });
    await this.host.submit(STAGE_PROMPTS.approve);
    await this.waitFor(() => this.host.hasInterrupt());

    this.host.beginRun('approve', { kind: 'resume', value: 'approved' });
    await this.host.resume('approved');
    await this.waitFor(() => !this.host.isRunning() && !this.host.hasInterrupt());

    await this.turn('render', STAGE_PROMPTS.render);
  }

  private async turn(beat: StageBeat, message: string, checkpointIndex?: number): Promise<void> {
    this.host.beginRun(beat, checkpointIndex !== undefined ? { kind: 'submit', message, checkpointIndex } : { kind: 'submit', message });
    await this.host.submit(message, checkpointIndex);
    await this.waitFor(() => !this.host.isRunning());
  }

  private async waitFor(pred: () => boolean): Promise<void> {
    let elapsed = 0;
    while (!pred()) {
      if (elapsed >= SCRIPT_WAIT_TIMEOUT_MS) throw new Error('stage script timed out waiting for the agent');
      await this.host.sleep(POLL_MS);
      elapsed += POLL_MS;
    }
  }
}
