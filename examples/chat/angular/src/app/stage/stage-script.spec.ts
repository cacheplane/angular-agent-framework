import { describe, expect, it } from 'vitest';
import { StageScript, STAGE_PROMPTS, type StageScriptHost } from './stage-script';

describe('StageScript', () => {
  it('walks the four beats in order, announcing each run\'s action before performing it', async () => {
    const log: string[] = [];
    let interrupt = false;
    let loading = false;
    const host: StageScriptHost = {
      beginRun: (beat, action) => log.push(`begin:${beat}:${action.kind}`),
      submit: async (message, checkpointIndex) => { log.push(`submit:${message}${checkpointIndex !== undefined ? `@${checkpointIndex}` : ''}`); loading = true; setTimeout(() => { loading = false; interrupt = message === STAGE_PROMPTS.approve; }, 1); },
      resume: async (value) => { log.push(`resume:${value}`); interrupt = false; },
      reload: async () => { log.push('reload'); },
      isRunning: () => loading,
      hasInterrupt: () => interrupt,
      forkIndex: () => 0,
      sleep: (ms) => new Promise((r) => setTimeout(r, Math.min(ms, 1))),
    };
    await new StageScript(host).run();
    expect(log).toEqual([
      'begin:stream:submit', `submit:${STAGE_PROMPTS.stream}`,
      'begin:persist:reload', 'reload',
      'begin:persist:submit', `submit:${STAGE_PROMPTS.shorter}`,
      'begin:persist:submit', `submit:${STAGE_PROMPTS.fork}@0`,
      'begin:approve:submit', `submit:${STAGE_PROMPTS.approve}`,
      'begin:approve:resume', 'resume:approved',
      'begin:render:submit', `submit:${STAGE_PROMPTS.render}`,
    ]);
  });
  it('times out rather than hanging when the agent never settles', async () => {
    const host: StageScriptHost = {
      beginRun: () => undefined, submit: async () => undefined, resume: async () => undefined, reload: async () => undefined,
      isRunning: () => true, hasInterrupt: () => false, forkIndex: () => 0, sleep: () => Promise.resolve(),
    };
    await expect(new StageScript(host).run()).rejects.toThrow(/timed out/);
  });
});
