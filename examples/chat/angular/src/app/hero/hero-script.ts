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
  /**
   * Whether the visitor asked for reduced motion. The runner deliberately does
   * NOT branch on it: reduced motion removes ANIMATION inside the host (the
   * prompt appears at once instead of a character at a time, the cursor jumps
   * instead of gliding) but never removes a beat, so both audiences follow the
   * same walkthrough at the same tempo. `hero-script.spec.ts` pins that.
   */
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

/* ── Pacing model ────────────────────────────────────────────────────────────
 *
 * Every hold below exists because a BEAT of the walkthrough needs it, and the
 * length of each one is an argument about what that beat has to communicate —
 * not a uniform rhythm. The parts a developer already understands (a person
 * typing into a composer) run about as fast as still reads as typing; the part
 * that carries the whole claim of the product — the agent stopping itself and
 * waiting for a human — is given room to be noticed and read.
 *
 * This is the ONE place these numbers live. `hero-mode.component.ts` imports
 * the two it needs rather than keeping its own copies, so the model cannot
 * drift apart from the host that enacts it.
 */

/**
 * Per keystroke while the walkthrough types a prompt. Nobody watching needs
 * to be taught what typing is, so this is only slow enough to read as a person
 * at a keyboard rather than a paste. Enacted by `HeroMode.typeInto()`.
 */
export const TYPE_DELAY_MS = 9;

/**
 * After the prompt is fully typed, before the cursor sets off for Send. The
 * reader has to finish the question before they are shown the answer to it;
 * without this the last character and the submission land together.
 */
export const HOLD_AFTER_TYPING_MS = 1200;

/**
 * One glide of the scripted pointer. Deliberate pointer motion is what makes
 * the walkthrough read as somebody using the product; hurrying it turns the
 * clicks into events that simply happen. Enacted by `HeroMode.moveCursor()`.
 */
export const CURSOR_MOVE_MS = 650;

/**
 * After the interrupt panel appears, before anything moves toward Accept.
 *
 * The longest hold in the walkthrough, on purpose. The agent has stopped
 * itself mid-task and is waiting on a human, and the PAUSE IS THE MESSAGE:
 * the reader needs long enough to notice the panel, read a proposal to delete
 * database backups, and register that nothing at all happens until someone
 * approves it. Approving instantly says the opposite — that the gate is a
 * formality — which is the one thing this demo must not say.
 *
 * CALIBRATED TO THE PROPOSAL COPY, which is currently ~60 words: four
 * seconds is enough to skim that and take its weight, not to read it word for
 * word. The two are coupled and nothing enforces the coupling — if the
 * recorded `request_approval` text in `public/hero-replay.json` grows, this
 * has to grow with it. A reader who cannot get through the proposal cannot
 * feel what approving it means, and the beat silently stops working.
 */
export const INTERRUPT_DWELL_MS = 4000;

/**
 * After the resumed answer has finished streaming, before the next prompt
 * starts. Lets the answer land instead of being shoved aside by new typing.
 */
export const HOLD_AFTER_ANSWER_MS = 2000;

/**
 * After the generated form has rendered, before the loop starts over. The
 * form is the payoff of the second prompt, so it gets the longest single
 * look — but not an unbounded one. This was 8000 when typing ate half the
 * loop and the hold was cheap; now that the walkthrough is tight, a third of
 * the runtime spent on a form that has stopped changing is the likeliest
 * place for a viewer to leave BEFORE seeing a whole cycle, which is the one
 * thing the loop exists to deliver.
 */
export const HOLD_AFTER_DONE_MS = 5000;

/**
 * How long a single waitFor() may poll before the run is declared failed.
 * It guards WAITING FOR A CONDITION — an interrupt arriving, a run going
 * quiet — not the total length of a pass, so the holds above never eat into
 * it and lengthening them does not bring this budget any closer.
 */
export const WAIT_TIMEOUT_MS = 30_000;

/** Polling granularity inside waitFor(). Not a pacing beat. */
export const POLL_MS = 50;

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
      await this.step(g, () => this.clock.sleep(HOLD_AFTER_TYPING_MS));
      await this.step(g, () => this.host.moveCursor('send'));
      await this.step(g, () => this.host.send());
      if (!(await this.waitFor(g, () => this.host.hasInterrupt()))) return;
      // The dwell belongs HERE and nowhere else: after the panel provably
      // exists, and before a single pixel moves toward Accept. Put it earlier
      // and it is a pause on an empty screen; put it later and the reader
      // watches a form being dismissed rather than a decision being made.
      await this.step(g, () => this.clock.sleep(INTERRUPT_DWELL_MS));
      await this.step(g, () => this.host.moveCursor('accept'));
      await this.step(g, () => this.host.acceptInterrupt());
      if (!(await this.waitFor(g, () => !this.host.isRunning() && !this.host.hasInterrupt()))) return;
      await this.step(g, () => this.clock.sleep(HOLD_AFTER_ANSWER_MS));
      await this.step(g, () => this.host.moveCursor('composer'));
      await this.step(g, () => this.host.typeInto(HERO_PROMPTS[1]));
      await this.step(g, () => this.clock.sleep(HOLD_AFTER_TYPING_MS));
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
