import { describe, it, expect, afterEach, vi } from 'vitest';
import { resolveAimockLaunch } from './aimock-mode';

describe('resolveAimockLaunch', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
    vi.restoreAllMocks();
  });

  it('unrecognized AIMOCK_MODE warns once and falls back to replay', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    process.env['AIMOCK_MODE'] = 'Record'; // case-sensitive: not 'record'
    process.env['OPENAI_API_KEY'] = 'sk-real';
    const launch = resolveAimockLaunch('/repo/x/fixtures');
    expect(launch.startOptions).toEqual({ mode: 'replay', fixturePath: '/repo/x/fixtures' });
    expect(launch.openaiApiKey).toBe('test-not-used');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('Record');
    expect(warn.mock.calls[0][0]).toContain('replay');
  });

  it('recognized modes do not warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    process.env['AIMOCK_MODE'] = 'replay';
    resolveAimockLaunch('/repo/x/fixtures');
    delete process.env['AIMOCK_MODE'];
    resolveAimockLaunch('/repo/x/fixtures');
    expect(warn).not.toHaveBeenCalled();
  });

  it('defaults to replay against the fixtures dir with a placeholder key', () => {
    delete process.env['AIMOCK_MODE'];
    const launch = resolveAimockLaunch('/repo/cockpit/x/angular/e2e/fixtures');
    expect(launch.startOptions).toEqual({ mode: 'replay', fixturePath: '/repo/cockpit/x/angular/e2e/fixtures' });
    expect(launch.openaiApiKey).toBe('test-not-used');
  });

  it('record mode reads AIMOCK_RECORD_DIR and passes the real key through', () => {
    process.env['AIMOCK_MODE'] = 'record';
    process.env['AIMOCK_RECORD_DIR'] = '/tmp/recordings';
    process.env['OPENAI_API_KEY'] = 'sk-real';
    const launch = resolveAimockLaunch('/repo/cockpit/x/angular/e2e/fixtures');
    expect(launch.startOptions).toEqual({ mode: 'record', recordDir: '/tmp/recordings' });
    expect(launch.openaiApiKey).toBe('sk-real');
  });

  it('record mode defaults recordDir next to the fixtures dir', () => {
    process.env['AIMOCK_MODE'] = 'record';
    delete process.env['AIMOCK_RECORD_DIR'];
    process.env['OPENAI_API_KEY'] = 'sk-real';
    const launch = resolveAimockLaunch('/repo/cockpit/x/angular/e2e/fixtures');
    expect(launch.startOptions).toEqual({ mode: 'record', recordDir: '/repo/cockpit/x/angular/e2e/.aimock-recordings' });
  });

  it('record mode without OPENAI_API_KEY throws', () => {
    process.env['AIMOCK_MODE'] = 'record';
    delete process.env['OPENAI_API_KEY'];
    expect(() => resolveAimockLaunch('/repo/x/fixtures')).toThrow('OPENAI_API_KEY');
  });
});
