import { describe, expect, it, vi } from 'vitest';
import { HERO_PROMPTS, HOLD_AFTER_DONE_MS, HeroScriptRunner, type HeroScriptHost } from './hero-script';

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

  it('skips the settle delay under reduced motion', async () => {
    const host = fakeHost();
    (host as { reducedMotion: boolean }).reducedMotion = true;
    const slept: number[] = [];
    const r = new HeroScriptRunner(host, {
      sleep: (ms) => {
        slept.push(ms);
        return new Promise((res) => setTimeout(res, 0));
      },
    });
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
    expect(slept).not.toContain(400);
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

async function until(pred: () => boolean, max = 2000): Promise<void> {
  for (let i = 0; i < max; i++) {
    if (pred()) return;
    await new Promise((res) => setTimeout(res, 0));
  }
  throw new Error('condition not met');
}
