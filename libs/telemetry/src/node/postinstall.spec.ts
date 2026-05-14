import { describe, test, expect, beforeEach, vi } from 'vitest';

vi.mock('./client', () => ({
  capturePostinstall: vi.fn().mockResolvedValue(undefined),
}));

import { capturePostinstallScript } from './postinstall';
import { capturePostinstall } from './client';

describe('postinstall script', () => {
  beforeEach(() => {
    vi.mocked(capturePostinstall).mockClear();
    delete process.env.CI;
    delete process.env.DO_NOT_TRACK;
  });

  test('calls capturePostinstall with the package name + version', async () => {
    const stdout: string[] = [];
    await capturePostinstallScript({
      readPackageJson: () => ({ name: '@ngaf/telemetry', version: '0.0.31' }),
      write: (s: string) => stdout.push(s),
      env: { ...process.env },
    });
    expect(capturePostinstall).toHaveBeenCalledWith({ pkg: '@ngaf/telemetry', version: '0.0.31' });
  });

  test('prints the opt-out notice to stdout when not CI', async () => {
    const stdout: string[] = [];
    await capturePostinstallScript({
      readPackageJson: () => ({ name: '@ngaf/telemetry', version: '0.0.31' }),
      write: (s: string) => stdout.push(s),
      env: { ...process.env },
    });
    expect(stdout.join('')).toMatch(/@ngaf\/telemetry: sent install ping/);
    expect(stdout.join('')).toMatch(/DO_NOT_TRACK=1/);
  });

  test('suppresses stdout notice when CI=true', async () => {
    const stdout: string[] = [];
    await capturePostinstallScript({
      readPackageJson: () => ({ name: '@ngaf/telemetry', version: '0.0.31' }),
      write: (s: string) => stdout.push(s),
      env: { ...process.env, CI: 'true' },
    });
    expect(stdout).toEqual([]);
  });

  test('swallows readPackageJson errors silently', async () => {
    await expect(
      capturePostinstallScript({
        readPackageJson: () => { throw new Error('not found'); },
        write: (_s: string) => undefined,
        env: { ...process.env },
      }),
    ).resolves.toBeUndefined();
    expect(capturePostinstall).not.toHaveBeenCalled();
  });
});
