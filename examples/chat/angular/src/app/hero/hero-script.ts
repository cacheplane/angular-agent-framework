import { signal } from '@angular/core';

/**
 * The two prompts must stay VERBATIM: aimock fixtures match on the exact user
 * message (see e2e/fixtures/interrupt-approval.json and contact-form.json), so
 * rewording either one breaks recording.
 */
export const HERO_PROMPTS = [
  'I want to clean up old database backups older than 90 days. Walk me through ' +
    'what you would delete, and call request_approval before doing anything ' +
    'destructive so I can review your plan.',
  'Show me a contact form with fields for name, email address, subject, and a multi-line message, plus a Send button.',
] as const;

export type CursorTarget = 'composer' | 'send' | 'accept';

export interface HeroScriptHost {
  readonly reducedMotion: boolean;
  typeInto(text: string): Promise<void>;
  send(): Promise<void>;
  acceptInterrupt(): Promise<void>;
  moveCursor(target: CursorTarget): Promise<void>;
  hasInterrupt(): boolean;
  isRunning(): boolean;
  restartReplay(): Promise<void>;
}

export interface ScriptClock {
  sleep(ms: number): Promise<void>;
}

export type HeroScriptState = 'idle' | 'waiting' | 'running' | 'paused' | 'done' | 'stopped' | 'error';

export const HOLD_AFTER_DONE_MS = 8000;
/** How long a single waitFor() may poll before the run is declared failed. */
export const WAIT_TIMEOUT_MS = 30_000;
const POLL_MS = 50;
const SETTLE_MS = 400;

const realClock: ScriptClock = { sleep: (ms) => new Promise((r) => setTimeout(r, ms)) };

export class HeroScriptRunner {
  readonly state = signal<HeroScriptState>('idle');
  private visible = false;
  /**
   * Generation token. Every start() takes a fresh one and stop() burns the
   * current one, so a run suspended in a sleep or behind the visibility gate
   * cannot resume and drive the host after it has been superseded.
   */
  private gen = 0;
  private readonly wakes = new Set<() => void>();

  constructor(private readonly host: HeroScriptHost, private readonly clock: ScriptClock = realClock) {}

  setVisible(v: boolean): void {
    this.visible = v;
    if (v) {
      if (this.state() === 'paused') this.state.set('running');
      this.wakeAll();
    } else if (this.state() === 'running') {
      this.state.set('paused');
    }
  }

  stop(): void {
    this.gen += 1;
    this.state.set('stopped');
    this.wakeAll();
  }

  /** Runs one full walkthrough. Resolves when done, stopped or failed. */
  async start(): Promise<void> {
    const g = ++this.gen;
    this.state.set('waiting');
    try {
      await this.gate(g);
      if (g !== this.gen) return;
      this.state.set('running');

      await this.step(g, () => this.host.moveCursor('composer'));
      await this.step(g, () => this.host.typeInto(HERO_PROMPTS[0]));
      await this.step(g, () => this.host.moveCursor('send'));
      await this.step(g, () => this.host.send());
      if (!(await this.waitFor(g, () => this.host.hasInterrupt()))) return;
      await this.step(g, () => this.host.moveCursor('accept'));
      await this.step(g, () => this.host.acceptInterrupt());
      if (!(await this.waitFor(g, () => !this.host.isRunning() && !this.host.hasInterrupt()))) return;
      if (!this.host.reducedMotion) await this.step(g, () => this.clock.sleep(SETTLE_MS));
      await this.step(g, () => this.host.moveCursor('composer'));
      await this.step(g, () => this.host.typeInto(HERO_PROMPTS[1]));
      await this.step(g, () => this.host.moveCursor('send'));
      await this.step(g, () => this.host.send());
      if (!(await this.waitFor(g, () => !this.host.isRunning()))) return;
      if (g !== this.gen) return;
      this.state.set('done');
    } catch (err) {
      console.error('hero script failed', err);
      if (g === this.gen) this.state.set('error');
    }
  }

  /**
   * Loops start() with a hold and a fresh replay between passes until stopped.
   * A failed pass (or a failing replay) is retried once after the hold; a
   * second consecutive failure ends the loop rather than spinning forever.
   */
  async loop(): Promise<void> {
    let failures = 0;
    for (;;) {
      await this.start();
      if (this.state() === 'stopped') return;
      if (this.state() === 'error') {
        failures += 1;
        if (failures > 1) {
          this.state.set('stopped');
          return;
        }
        await this.clock.sleep(HOLD_AFTER_DONE_MS);
        if (this.state() === 'stopped') return;
        continue;
      }

      await this.clock.sleep(HOLD_AFTER_DONE_MS);
      if (this.state() === 'stopped') return;
      try {
        await this.host.restartReplay();
        failures = 0;
      } catch (err) {
        console.error('hero script replay restart failed', err);
        failures += 1;
        if (failures > 1) {
          this.state.set('stopped');
          return;
        }
        await this.clock.sleep(HOLD_AFTER_DONE_MS);
        if (this.state() === 'stopped') return;
      }
    }
  }

  private async step(g: number, fn: () => Promise<void>): Promise<void> {
    if (g !== this.gen) return;
    await this.gate(g);
    if (g !== this.gen) return;
    await fn();
  }

  /**
   * Polls until `pred` holds. Returns false when the run should end — either it
   * was superseded, or the condition never arrived within WAIT_TIMEOUT_MS.
   */
  private async waitFor(g: number, pred: () => boolean): Promise<boolean> {
    let elapsed = 0;
    while (g === this.gen) {
      await this.gate(g);
      if (g !== this.gen) return false;
      if (pred()) return true;
      if (elapsed >= WAIT_TIMEOUT_MS) {
        this.state.set('error');
        return false;
      }
      await this.clock.sleep(POLL_MS);
      elapsed += POLL_MS;
    }
    return false;
  }

  /** Blocks while hidden. */
  private gate(g: number): Promise<void> {
    if (this.visible || g !== this.gen) return Promise.resolve();
    return new Promise((resolve) => {
      const wake = () => {
        this.wakes.delete(wake);
        resolve();
      };
      this.wakes.add(wake);
    });
  }

  private wakeAll(): void {
    for (const wake of [...this.wakes]) wake();
  }
}
