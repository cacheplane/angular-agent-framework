// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { parseArgs, runRemint, type RemintDeps } from './remint.js';
import type { License } from '@cacheplane/db';

function makeLicense(overrides: Partial<License> = {}): License {
  return {
    id: 'lic_1',
    stripeCustomerId: 'cus_1',
    stripeSubscriptionId: 'sub_1',
    customerEmail: 'a@example.com',
    tier: 'developer-seat',
    seats: 3,
    expiresAt: new Date('2027-01-01T00:00:00Z'),
    revokedAt: null,
    lastToken: 'TOKEN.SIG',
    issuedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as License;
}

function makeDeps(overrides: Partial<RemintDeps> = {}): RemintDeps {
  return {
    db: {} as any,
    getLicense: vi.fn().mockResolvedValue(makeLicense()),
    updateLicenseToken: vi.fn().mockImplementation(async (_db, _id, token) =>
      makeLicense({ lastToken: token, issuedAt: new Date() }),
    ),
    mintToken: vi.fn().mockResolvedValue('NEW.TOKEN'),
    sendLicenseEmail: vi.fn().mockResolvedValue({ resendId: 're_1' }),
    resendApiKey: 're_test',
    emailFrom: 'from@example.com',
    privateKeyHex: 'a'.repeat(64),
    ...overrides,
  };
}

describe('parseArgs', () => {
  it('parses --sub', () => {
    expect(parseArgs(['--sub=sub_abc']).sub).toBe('sub_abc');
  });

  it('defaults dryRun and newToken to false, to to undefined', () => {
    const a = parseArgs(['--sub=sub_x']);
    expect(a.dryRun).toBe(false);
    expect(a.newToken).toBe(false);
    expect(a.to).toBeUndefined();
  });

  it('recognises --dry-run, --new-token, --to', () => {
    const a = parseArgs(['--sub=sub_x', '--dry-run', '--new-token', '--to=b@b.c']);
    expect(a.dryRun).toBe(true);
    expect(a.newToken).toBe(true);
    expect(a.to).toBe('b@b.c');
  });

  it('throws if --sub is missing', () => {
    expect(() => parseArgs([])).toThrow(/--sub/);
  });
});

describe('runRemint', () => {
  it('sends email with existing token by default', async () => {
    const deps = makeDeps();
    const result = await runRemint({ sub: 'sub_1', dryRun: false, newToken: false }, deps);
    expect(deps.mintToken).not.toHaveBeenCalled();
    expect(deps.sendLicenseEmail).toHaveBeenCalledTimes(1);
    const sendArg = (deps.sendLicenseEmail as unknown as { mock: { calls: any[][] } }).mock.calls[0][0];
    expect(sendArg.to).toBe('a@example.com');
    expect(sendArg.vars.token).toBe('TOKEN.SIG');
    expect(result.sent).toBe(true);
  });

  it('overrides destination with --to', async () => {
    const deps = makeDeps();
    await runRemint({ sub: 'sub_1', dryRun: false, newToken: false, to: 'new@b.c' }, deps);
    const sendArg = (deps.sendLicenseEmail as unknown as { mock: { calls: any[][] } }).mock.calls[0][0];
    expect(sendArg.to).toBe('new@b.c');
  });

  it('mints and persists a new token with --new-token', async () => {
    const deps = makeDeps();
    await runRemint({ sub: 'sub_1', dryRun: false, newToken: true }, deps);
    expect(deps.mintToken).toHaveBeenCalledTimes(1);
    expect(deps.updateLicenseToken).toHaveBeenCalledTimes(1);
    const sendArg = (deps.sendLicenseEmail as unknown as { mock: { calls: any[][] } }).mock.calls[0][0];
    expect(sendArg.vars.token).toBe('NEW.TOKEN');
  });

  it('does not send email with --dry-run', async () => {
    const deps = makeDeps();
    const result = await runRemint({ sub: 'sub_1', dryRun: true, newToken: false }, deps);
    expect(deps.sendLicenseEmail).not.toHaveBeenCalled();
    expect(result.sent).toBe(false);
    expect(result.preview).toBeDefined();
  });

  it('refuses when license is revoked', async () => {
    const deps = makeDeps({
      getLicense: vi.fn().mockResolvedValue(makeLicense({ revokedAt: new Date() })),
    });
    await expect(
      runRemint({ sub: 'sub_1', dryRun: false, newToken: false }, deps),
    ).rejects.toThrow(/revoked/);
  });

  it('throws when license does not exist', async () => {
    const deps = makeDeps({ getLicense: vi.fn().mockResolvedValue(null) });
    await expect(
      runRemint({ sub: 'sub_nope', dryRun: false, newToken: false }, deps),
    ).rejects.toThrow(/sub_nope/);
  });
});
