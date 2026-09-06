import type { StageAction, StageBeat } from './stage-recording.types';

/**
 * The four beats, verbatim. The approve and render prompts are the hero's, so
 * the stage shows the same run the hero teases; the stream prompt is the demo's
 * search-and-cite chip; the persist prompts are short on purpose.
 */
export const STAGE_PROMPTS = {
  stream:
    'Use the search tool to find authoritative information about Angular signals, then explain what they are and when to use them. Cite each source inline as [^doc-id] using the document `id` field returned by the tool.',
  shorter: 'Shorter, please.',
  fork: 'Make it a haiku instead.',
  approve: 'Clean up our old database backups, anything older than 90 days.',
  render: 'Show me a contact form with fields for name, email address, subject, and a multi-line message, plus a Send button.',
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
  /** Index into history() of the checkpoint to fork from: the first answer's. */
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

    this.host.beginRun('persist', { kind: 'reload' });
    await this.host.reload();

    await this.turn('persist', STAGE_PROMPTS.shorter);

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
