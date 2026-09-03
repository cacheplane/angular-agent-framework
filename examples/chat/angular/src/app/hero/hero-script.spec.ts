// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { HeroScriptRunner, HERO_PROMPTS, type HeroScriptHost } from './hero-script';

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

const clock = { sleep: async () => {} };

describe('HeroScriptRunner', () => {
  it('waits for visibility before typing', async () => {
    const host = fakeHost();
    const r = new HeroScriptRunner(host, clock);
    r.start();
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
    await Promise.resolve();
    expect(host.log).not.toContain('accept');
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
    await Promise.resolve();
    expect(host.log.length).toBe(n);
  });
});

async function until(pred: () => boolean, max = 200): Promise<void> {
  for (let i = 0; i < max; i++) {
    if (pred()) return;
    await new Promise((res) => setTimeout(res, 0));
  }
  throw new Error('condition not met');
}
