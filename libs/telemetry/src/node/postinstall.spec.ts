import { describe, test, expect, beforeEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, symlinkSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

vi.mock('./client', async () => {
  const actual = await vi.importActual<typeof import('./client')>('./client');
  return {
    ...actual,
    capturePostinstall: vi.fn().mockResolvedValue({ sent: true }),
  };
});

import { capturePostinstallScript } from './postinstall';
import { capturePostinstall } from './client';

describe('postinstall script', () => {
  beforeEach(() => {
    vi.mocked(capturePostinstall).mockClear();
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;
    delete process.env.CONTINUOUS_INTEGRATION;
    delete process.env.BUILDKITE;
    delete process.env.CIRCLECI;
    delete process.env.DO_NOT_TRACK;
    delete process.env.npm_config_do_not_track;
    delete process.env.NPM_CONFIG_DO_NOT_TRACK;
    delete process.env.DEBUG;
    delete process.env.NGAF_TELEMETRY_DISABLED;
  });

  test('calls capturePostinstall with the package name + version', async () => {
    const stdout: string[] = [];
    await capturePostinstallScript({
      readPackageJson: () => ({ name: '@threadplane/telemetry', version: '0.0.31' }),
      write: (s: string) => stdout.push(s),
      env: { ...process.env },
      cwd: () => '/tmp/project/node_modules/@threadplane/telemetry',
    });
    expect(capturePostinstall).toHaveBeenCalledWith({ pkg: '@threadplane/telemetry', version: '0.0.31' });
  });

  test('prints the opt-out notice to stdout when not CI', async () => {
    const stdout: string[] = [];
    await capturePostinstallScript({
      readPackageJson: () => ({ name: '@threadplane/telemetry', version: '0.0.31' }),
      write: (s: string) => stdout.push(s),
      env: { ...process.env },
      cwd: () => '/tmp/project/node_modules/@threadplane/telemetry',
    });
    expect(stdout.join('')).toMatch(/@threadplane\/telemetry: install telemetry sent/);
    expect(stdout.join('')).toMatch(/DO_NOT_TRACK=1/);
  });

  test('CI=true is full opt-out: no event sent and no stdout notice', async () => {
    const stdout: string[] = [];
    await capturePostinstallScript({
      readPackageJson: () => ({ name: '@threadplane/telemetry', version: '0.0.31' }),
      write: (s: string) => stdout.push(s),
      env: { ...process.env, CI: 'true' },
      cwd: () => '/tmp/project/node_modules/@threadplane/telemetry',
    });
    expect(stdout).toEqual([]);
    expect(capturePostinstall).not.toHaveBeenCalled();
  });

  test('DO_NOT_TRACK=1 is full opt-out: no event sent and no stdout notice', async () => {
    const stdout: string[] = [];
    await capturePostinstallScript({
      readPackageJson: () => ({ name: '@threadplane/telemetry', version: '0.0.31' }),
      write: (s: string) => stdout.push(s),
      env: { ...process.env, DO_NOT_TRACK: '1' },
      cwd: () => '/tmp/project/node_modules/@threadplane/telemetry',
    });
    expect(stdout).toEqual([]);
    expect(capturePostinstall).not.toHaveBeenCalled();
  });

  test('swallows readPackageJson errors silently', async () => {
    await expect(
      capturePostinstallScript({
        readPackageJson: () => { throw new Error('not found'); },
        write: (_s: string) => undefined,
        env: { ...process.env },
        cwd: () => '/tmp/project/node_modules/@threadplane/telemetry',
      }),
    ).resolves.toBeUndefined();
    expect(capturePostinstall).not.toHaveBeenCalled();
  });

  test('does not print sent when capturePostinstall reports a failed send', async () => {
    vi.mocked(capturePostinstall).mockResolvedValueOnce({ sent: false, reason: 'failed' });
    const stdout: string[] = [];
    await capturePostinstallScript({
      readPackageJson: () => ({ name: '@threadplane/telemetry', version: '0.0.31' }),
      write: (s: string) => stdout.push(s),
      env: { ...process.env },
      cwd: () => '/tmp/project/node_modules/@threadplane/telemetry',
    });
    expect(stdout.join('')).not.toMatch(/sent install ping|install telemetry sent/);
  });

  test('skips local top-level installs by default', async () => {
    await capturePostinstallScript({
      readPackageJson: () => ({ name: '@threadplane/chat', version: '0.0.31' }),
      write: (_s: string) => undefined,
      env: { ...process.env, INIT_CWD: '/repo/libs/chat' },
      cwd: () => '/repo/libs/chat',
    });
    expect(capturePostinstall).not.toHaveBeenCalled();
  });

  test('skips local top-level installs when INIT_CWD and cwd differ only by symlink', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ngaf-postinstall-'));
    const link = `${root}-link`;
    try {
      mkdirSync(join(root, 'pkg'), { recursive: true });
      symlinkSync(root, link, 'dir');
      await capturePostinstallScript({
        readPackageJson: () => ({ name: '@threadplane/chat', version: '0.0.31' }),
        write: (_s: string) => undefined,
        env: { ...process.env, INIT_CWD: join(link, 'pkg') },
        cwd: () => join(root, 'pkg'),
      });
      expect(capturePostinstall).not.toHaveBeenCalled();
    } finally {
      rmSync(link, { recursive: true, force: true });
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('allows global installs even when INIT_CWD matches cwd', async () => {
    await capturePostinstallScript({
      readPackageJson: () => ({ name: '@threadplane/chat', version: '0.0.31' }),
      write: (_s: string) => undefined,
      env: { ...process.env, INIT_CWD: '/repo/libs/chat', npm_config_global: 'true' },
      cwd: () => '/repo/libs/chat',
    });
    expect(capturePostinstall).toHaveBeenCalledWith({ pkg: '@threadplane/chat', version: '0.0.31' });
  });

  test('prints exact payload when DEBUG includes ngaf:telemetry', async () => {
    const stdout: string[] = [];
    await capturePostinstallScript({
      readPackageJson: () => ({ name: '@threadplane/chat', version: '0.0.31' }),
      write: (s: string) => stdout.push(s),
      env: {
        ...process.env,
        DEBUG: 'foo,ngaf:telemetry',
        npm_config_user_agent: 'npm/10.9.2 node/v22.14.0 darwin arm64 workspaces/false',
      },
      cwd: () => '/tmp/project/node_modules/@threadplane/chat',
    });
    expect(stdout.join('')).toMatch(/"pkg":"@threadplane\/chat"/);
    expect(stdout.join('')).toMatch(/"version":"0.0.31"/);
    expect(stdout.join('')).toMatch(/"package_manager":"npm"/);
    expect(stdout.join('')).toMatch(/"package_manager_version":"10.9.2"/);
  });
});
