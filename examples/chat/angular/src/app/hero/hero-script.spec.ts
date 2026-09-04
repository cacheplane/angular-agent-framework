import { describe, expect, it, vi } from 'vitest';
import {
  HERO_PROMPTS,
  HOLD_AFTER_ANSWER_MS,
  HOLD_AFTER_DONE_MS,
  HOLD_AFTER_TYPING_MS,
  INTERRUPT_DWELL_MS,
  POLL_MS,
  HeroScriptRunner,
  type HeroScriptHost,
  type ScriptClock,
} from './hero-script';

interface FakeHost extends HeroScriptHost {
  log: string[];
  interruptPresent: boolean;
  running: boolean;
}

function fakeHost(): FakeHost {
  const host: FakeHost = {
    log: [],
    interruptPresent: false,
    running: false,
    reducedMotion: false,
    typeInto: async (text) => {
      host.log.push(`type:${text}`);
    },
    send: async () => {
      host.log.push('send');
      host.running = true;
    },
    acceptInterrupt: async () => {
      host.log.push('accept');
      host.interruptPresent = false;
      host.running = true;
    },
    moveCursor: async (target) => {
      host.log.push(`cursor:${target}`);
    },
    hasInterrupt: () => host.interruptPresent,
    isRunning: () => host.running,
    restartReplay: async () => {
      host.log.push('restart');
    },
  };
  return host;
}

/** A host that drives itself to completion so loop() can be exercised. */
function autoHost(): FakeHost {
  const host = fakeHost();
  let sends = 0;
  host.send = async () => {
    host.log.push('send');
    sends += 1;
    const first = sends === 1;
    host.running = true;
    setTimeout(() => {
      host.running = false;
      if (first) host.interruptPresent = true;
    }, 0);
  };
  host.acceptInterrupt = async () => {
    host.log.push('accept');
    host.interruptPresent = false;
    host.running = true;
    setTimeout(() => {
      host.running = false;
    }, 0);
  };
  host.restartReplay = async () => {
    host.log.push('restart');
    sends = 0;
  };
  return host;
}

/** Yields a macrotask per sleep so the runner still makes progress under test. */
const clock = { sleep: () => new Promise<void>((r) => setTimeout(r, 0)) };

/**
 * A clock that writes each hold into the SAME log the host writes its actions
 * into, so a spec can assert the pacing beats and the actions as one ordered
 * sequence instead of two lists it has to correlate by hand.
 */
function beatClock(log: string[]): ScriptClock {
  return {
    sleep: (ms) => {
      log.push(`sleep:${ms}`);
      return new Promise((r) => setTimeout(r, 0));
    },
  };
}

/** The interleaved log with waitFor()'s polling noise dropped. */
function beatsOf(log: string[]): string[] {
  return log.filter((entry) => entry !== `sleep:${POLL_MS}`);
}

/** Feeds a fakeHost() the state changes a real replay would produce. */
async function driveOnePass(host: FakeHost): Promise<void> {
  await until(() => host.log.includes('send'));
  host.running = false;
  host.interruptPresent = true;
  await until(() => host.log.includes('accept'));
  host.running = false;
  await until(() => host.log.filter((l) => l === 'send').length === 2);
  host.running = false;
}

async function drain(n = 25): Promise<void> {
  for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0));
}

describe('HeroScriptRunner', () => {
  it('waits for visibility before typing', async () => {
    const host = fakeHost();
    const r = new HeroScriptRunner(host, clock);
    void r.start();
    await Promise.resolve();
    expect(host.log).toEqual([]);
    expect(r.state()).toBe('waiting');
  });

  it('runs prompt → send → accept → prompt 2 → send → done', async () => {
    const host = fakeHost();
    const r = new HeroScriptRunner(host, clock);
    r.setVisible(true);
    const done = r.start();
    await until(() => host.log.includes('send'));
    host.running = false;
    host.interruptPresent = true;
    await until(() => host.log.includes('accept'));
    host.running = false;
    await until(() => host.log.filter((l) => l === 'send').length === 2);
    host.running = false;
    await done;
    expect(host.log).toEqual([
      'cursor:composer',
      `type:${HERO_PROMPTS[0]}`,
      'cursor:send',
      'send',
      'cursor:accept',
      'accept',
      'cursor:composer',
      `type:${HERO_PROMPTS[1]}`,
      'cursor:send',
      'send',
    ]);
    expect(r.state()).toBe('done');
  });

  it('pauses when hidden and resumes where it stopped', async () => {
    const host = fakeHost();
    const r = new HeroScriptRunner(host, clock);
    r.setVisible(true);
    const done = r.start();
    await until(() => host.log.includes('send'));
    r.setVisible(false);
    expect(r.state()).toBe('paused');
    host.running = false;
    host.interruptPresent = true;
    await drain(20);
    expect(host.log).not.toContain('accept');
    expect(r.state()).toBe('paused');
    r.setVisible(true);
    await until(() => host.log.includes('accept'));
    r.stop();
    await done;
  });

  it('stop() ends the run without further host calls', async () => {
    const host = fakeHost();
    const r = new HeroScriptRunner(host, clock);
    r.setVisible(true);
    const done = r.start();
    await until(() => host.log.includes('send'));
    r.stop();
    await done;
    expect(r.state()).toBe('stopped');
    const n = host.log.length;
    host.running = false;
    host.interruptPresent = true;
    await drain(20);
    expect(host.log.length).toBe(n);
  });

  it('a run stopped mid-flight never resumes after a fresh start()', async () => {
    const host = fakeHost();
    const r = new HeroScriptRunner(host, clock);
    r.setVisible(true);
    const first = r.start();
    await until(() => host.log.includes('send'));
    r.stop();
    const second = r.start();
    await until(() => host.log.filter((l) => l === 'send').length === 2);
    host.running = false;
    host.interruptPresent = true;
    await until(() => host.log.includes('accept'));
    host.running = false;
    await until(() => host.log.filter((l) => l === 'send').length === 3);
    host.running = false;
    await Promise.all([first, second]);
    await drain(30);
    expect(host.log.filter((l) => l === 'send').length).toBe(3);
    expect(host.log.filter((l) => l === 'accept').length).toBe(1);
    expect(r.state()).toBe('done');
  });

  it('ends in error when the awaited condition never arrives', async () => {
    const host = fakeHost();
    const r = new HeroScriptRunner(host, clock);
    r.setVisible(true);
    await r.start();
    expect(r.state()).toBe('error');
    expect(host.log).not.toContain('accept');
  });

  it('ends in error when the host throws, without rejecting', async () => {
    const host = fakeHost();
    host.typeInto = async () => {
      throw new Error('boom');
    };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => void 0);
    const r = new HeroScriptRunner(host, clock);
    r.setVisible(true);
    await expect(r.start()).resolves.toBeUndefined();
    expect(r.state()).toBe('error');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('loop() replays between passes and stops during the hold', async () => {
    const host = autoHost();
    let holds = 0;
    const r: HeroScriptRunner = new HeroScriptRunner(host, {
      sleep: (ms) => {
        if (ms === HOLD_AFTER_DONE_MS) {
          holds += 1;
          if (holds === 2) r.stop();
        }
        return new Promise((res) => setTimeout(res, 0));
      },
    });
    r.setVisible(true);
    await r.loop();
    expect(r.state()).toBe('stopped');
    expect(host.log.filter((l) => l === 'restart').length).toBe(1);
    expect(host.log.filter((l) => l === 'send').length).toBe(4);
  });

  it('loop() resolves when restartReplay throws', async () => {
    const host = autoHost();
    host.restartReplay = async () => {
      throw new Error('nope');
    };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => void 0);
    const r = new HeroScriptRunner(host, clock);
    r.setVisible(true);
    await expect(r.loop()).resolves.toBeUndefined();
    expect(r.state()).toBe('stopped');
    spy.mockRestore();
  });
});

/**
 * The pacing of the walkthrough is a product claim, not a cosmetic detail:
 * typing runs fast because nobody needs to be taught what typing is, and the
 * approval gate holds because "the agent stopped and waited for a human" is
 * the thing the demo exists to show. These specs pin the beats in order.
 */
describe('HeroScriptRunner pacing', () => {
  it('holds each beat in order, dwelling on the interrupt before reaching for Accept', async () => {
    const host = fakeHost();
    const r = new HeroScriptRunner(host, beatClock(host.log));
    r.setVisible(true);
    const done = r.start();
    await driveOnePass(host);
    await done;

    expect(beatsOf(host.log)).toEqual([
      'cursor:composer',
      `type:${HERO_PROMPTS[0]}`,
      `sleep:${HOLD_AFTER_TYPING_MS}`,
      'cursor:send',
      'send',
      // The beat the whole demo turns on: the panel is up and NOTHING moves.
      `sleep:${INTERRUPT_DWELL_MS}`,
      'cursor:accept',
      'accept',
      `sleep:${HOLD_AFTER_ANSWER_MS}`,
      'cursor:composer',
      `type:${HERO_PROMPTS[1]}`,
      `sleep:${HOLD_AFTER_TYPING_MS}`,
      'cursor:send',
      'send',
    ]);
  });

  it('starts the dwell only once the interrupt exists, and blocks Accept until it ends', async () => {
    const host = fakeHost();
    const slept: number[] = [];
    let releaseDwell: (() => void) | null = null;
    const r = new HeroScriptRunner(host, {
      sleep: (ms) => {
        slept.push(ms);
        // Hold the dwell open so "Accept waits for it" is observable rather
        // than inferred from an ordering that a zero-length sleep also gives.
        if (ms === INTERRUPT_DWELL_MS) return new Promise<void>((res) => (releaseDwell = res));
        return new Promise((res) => setTimeout(res, 0));
      },
    });
    r.setVisible(true);
    void r.start();

    await until(() => host.log.includes('send'));
    await drain(10);
    // No interrupt yet: there is nothing to dwell on and nothing to approve.
    expect(slept).not.toContain(INTERRUPT_DWELL_MS);
    expect(host.log).not.toContain('cursor:accept');

    host.running = false;
    host.interruptPresent = true;
    await until(() => slept.includes(INTERRUPT_DWELL_MS));
    await drain(10);
    expect(host.log).not.toContain('cursor:accept');

    releaseDwell!();
    await until(() => host.log.includes('cursor:accept'));
    r.stop();
  });

  it('a dwell that ends while the frame is hidden does not go on to approve', async () => {
    const host = fakeHost();
    let releaseDwell: (() => void) | null = null;
    const r = new HeroScriptRunner(host, {
      sleep: (ms) =>
        ms === INTERRUPT_DWELL_MS
          ? new Promise<void>((res) => (releaseDwell = res))
          : new Promise((res) => setTimeout(res, 0)),
    });
    r.setVisible(true);
    void r.start();
    await until(() => host.log.includes('send'));
    host.running = false;
    host.interruptPresent = true;
    await until(() => releaseDwell !== null);

    r.setVisible(false);
    releaseDwell!();
    await drain(20);
    expect(host.log).not.toContain('cursor:accept');
    expect(r.state()).toBe('paused');

    r.setVisible(true);
    await until(() => host.log.includes('cursor:accept'));
    r.stop();
  });

  it('a run superseded during the dwell never presses Accept', async () => {
    const host = fakeHost();
    let releaseDwell: (() => void) | null = null;
    const r = new HeroScriptRunner(host, {
      sleep: (ms) =>
        ms === INTERRUPT_DWELL_MS
          ? new Promise<void>((res) => (releaseDwell = res))
          : new Promise((res) => setTimeout(res, 0)),
    });
    r.setVisible(true);
    const done = r.start();
    await until(() => host.log.includes('send'));
    host.running = false;
    host.interruptPresent = true;
    await until(() => releaseDwell !== null);

    r.stop();
    releaseDwell!();
    await done;
    await drain(20);
    expect(host.log).not.toContain('cursor:accept');
    expect(host.log).not.toContain('accept');
  });

  it('reduced motion keeps every beat: the sequence is identical either way', async () => {
    const beatsFor = async (reducedMotion: boolean): Promise<string[]> => {
      const host = fakeHost();
      (host as { reducedMotion: boolean }).reducedMotion = reducedMotion;
      const r = new HeroScriptRunner(host, beatClock(host.log));
      r.setVisible(true);
      const done = r.start();
      await driveOnePass(host);
      await done;
      return beatsOf(host.log);
    };

    const reduced = await beatsFor(true);
    expect(reduced).toEqual(await beatsFor(false));
    // Guards against the pair matching because both are empty or beat-free.
    expect(reduced).toContain(`sleep:${INTERRUPT_DWELL_MS}`);
    expect(reduced).toContain(`sleep:${HOLD_AFTER_ANSWER_MS}`);
    expect(reduced.filter((b) => b === `sleep:${HOLD_AFTER_TYPING_MS}`)).toHaveLength(2);
  });
});

async function until(pred: () => boolean, max = 2000): Promise<void> {
  for (let i = 0; i < max; i++) {
    if (pred()) return;
    await new Promise((res) => setTimeout(res, 0));
  }
  throw new Error('condition not met');
}
