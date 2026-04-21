// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
const REQUIRED = {
  STRIPE_SECRET_KEY: 'sk_test_xxx',
  STRIPE_WEBHOOK_SECRET: 'whsec_xxx',
  DATABASE_URL: 'postgres://u:p@h:5432/d',
  RESEND_API_KEY: 're_xxx',
  EMAIL_FROM: 'a@b.c',
  LICENSE_SIGNING_PRIVATE_KEY_HEX: 'a'.repeat(64),
};

function setEnv(vars: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

describe('loadEnv', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('loads all required vars successfully', async () => {
    setEnv(REQUIRED);
    const { loadEnv } = await import('./env.js');
    const env = loadEnv();
    expect(env.STRIPE_SECRET_KEY).toBe('sk_test_xxx');
    expect(env.LICENSE_DEFAULT_TTL_DAYS).toBe(365);
  });

  it('throws with a list of all missing vars', async () => {
    setEnv({ ...REQUIRED, STRIPE_SECRET_KEY: undefined, DATABASE_URL: undefined });
    const { loadEnv } = await import('./env.js');
    expect(() => loadEnv()).toThrow(/STRIPE_SECRET_KEY.*DATABASE_URL|DATABASE_URL.*STRIPE_SECRET_KEY/);
  });

  it('throws when private key hex is the wrong length', async () => {
    setEnv({ ...REQUIRED, LICENSE_SIGNING_PRIVATE_KEY_HEX: 'abc' });
    const { loadEnv } = await import('./env.js');
    expect(() => loadEnv()).toThrow(/64 hex chars/);
  });

  it('throws when private key hex has non-hex characters', async () => {
    setEnv({ ...REQUIRED, LICENSE_SIGNING_PRIVATE_KEY_HEX: 'z'.repeat(64) });
    const { loadEnv } = await import('./env.js');
    expect(() => loadEnv()).toThrow(/64 hex chars/);
  });

  it('accepts a custom LICENSE_DEFAULT_TTL_DAYS', async () => {
    setEnv({ ...REQUIRED, LICENSE_DEFAULT_TTL_DAYS: '30' });
    const { loadEnv } = await import('./env.js');
    const env = loadEnv();
    expect(env.LICENSE_DEFAULT_TTL_DAYS).toBe(30);
  });
});
