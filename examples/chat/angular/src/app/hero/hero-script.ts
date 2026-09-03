// SPDX-License-Identifier: MIT
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

export type HeroScriptState = 'idle' | 'waiting' | 'running' | 'paused' | 'done' | 'stopped';

export const HOLD_AFTER_DONE_MS = 8000;
const POLL_MS = 50;
const SETTLE_MS = 400;

const realClock: ScriptClock = { sleep: (ms) => new Promise((r) => setTimeout(r, ms)) };

export class HeroScriptRunner {
  readonly state = signal<HeroScriptState>('idle');
  private visible = false;
  private stopped = false;
  private wake: (() => void) | null = null;

  constructor(private readonly host: HeroScriptHost, private readonly clock: ScriptClock = realClock) {}

  setVisible(v: boolean): void {
    this.visible = v;
    if (v) {
      if (this.state() === 'paused') this.state.set('running');
      this.wake?.();
    } else if (this.state() === 'running') {
      this.state.set('paused');
    }
  }

  stop(): void {
    this.stopped = true;
    this.state.set('stopped');
    this.wake?.();
  }

  /** Runs one full walkthrough. Resolves when done or stopped. */
  async start(): Promise<void> {
    this.stopped = false;
    this.state.set('waiting');
    await this.gate();
    if (this.stopped) return;
    this.state.set('running');

    await this.step(() => this.host.moveCursor('composer'));
    await this.step(() => this.host.typeInto(HERO_PROMPTS[0]));
    await this.step(() => this.host.moveCursor('send'));
    await this.step(() => this.host.send());
    await this.waitFor(() => this.host.hasInterrupt());
    await this.step(() => this.host.moveCursor('accept'));
    await this.step(() => this.host.acceptInterrupt());
    await this.waitFor(() => !this.host.isRunning() && !this.host.hasInterrupt());
    await this.step(() => this.clock.sleep(SETTLE_MS));
    await this.step(() => this.host.moveCursor('composer'));
    await this.step(() => this.host.typeInto(HERO_PROMPTS[1]));
    await this.step(() => this.host.moveCursor('send'));
    await this.step(() => this.host.send());
    await this.waitFor(() => !this.host.isRunning());
    if (this.stopped) return;
    this.state.set('done');
  }

  /**
   * Loops start() with a hold and a fresh replay between passes until stopped.
   * Note: start() resets `stopped = false` at its top, so a stop() that races
   * with the very beginning of a new start() call can be lost. Accepted
   * tradeoff — the loop is only ever driven by this class's own callers.
   */
  async loop(): Promise<void> {
    while (!this.stopped) {
      await this.start();
      if (this.stopped) return;
      await this.clock.sleep(HOLD_AFTER_DONE_MS);
      if (this.stopped) return;
      await this.host.restartReplay();
    }
  }

  private async step(fn: () => Promise<void>): Promise<void> {
    if (this.stopped) return;
    await this.gate();
    if (this.stopped) return;
    await fn();
  }

  private async waitFor(pred: () => boolean): Promise<void> {
    while (!this.stopped) {
      await this.gate();
      if (this.stopped) return;
      if (pred()) return;
      await this.clock.sleep(POLL_MS);
      await new Promise((r) => setTimeout(r, 0)); // yield a macrotask even with a zero-delay clock
    }
  }

  /** Blocks while hidden. */
  private gate(): Promise<void> {
    if (this.visible || this.stopped) return Promise.resolve();
    return new Promise((resolve) => {
      this.wake = () => {
        this.wake = null;
        resolve();
      };
    });
  }
}
