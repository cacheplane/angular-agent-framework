// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
const REQUIRED_VARS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'DATABASE_URL',
  'RESEND_API_KEY',
  'EMAIL_FROM',
  'LICENSE_SIGNING_PRIVATE_KEY_HEX',
] as const;

export interface Env {
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  DATABASE_URL: string;
  RESEND_API_KEY: string;
  EMAIL_FROM: string;
  LICENSE_SIGNING_PRIVATE_KEY_HEX: string;
  LICENSE_DEFAULT_TTL_DAYS: number;
}

export function loadEnv(): Env {
  const missing = REQUIRED_VARS.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }

  const keyHex = process.env['LICENSE_SIGNING_PRIVATE_KEY_HEX']!;
  if (!/^[0-9a-f]{64}$/i.test(keyHex)) {
    throw new Error('LICENSE_SIGNING_PRIVATE_KEY_HEX must be 64 hex chars (32 bytes)');
  }

  return {
    STRIPE_SECRET_KEY: process.env['STRIPE_SECRET_KEY']!,
    STRIPE_WEBHOOK_SECRET: process.env['STRIPE_WEBHOOK_SECRET']!,
    DATABASE_URL: process.env['DATABASE_URL']!,
    RESEND_API_KEY: process.env['RESEND_API_KEY']!,
    EMAIL_FROM: process.env['EMAIL_FROM']!,
    LICENSE_SIGNING_PRIVATE_KEY_HEX: keyHex,
    LICENSE_DEFAULT_TTL_DAYS: Number(process.env['LICENSE_DEFAULT_TTL_DAYS'] ?? 365),
  };
}
