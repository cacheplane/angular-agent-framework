// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  createDb,
  getLicense,
  updateLicenseToken,
  type Db,
  type License,
} from '@cacheplane/db';
import { loadEnv } from '../src/lib/env.js';
import { mintToken } from '../src/lib/sign.js';
import { sendLicenseEmail, renderLicenseEmail, type RenderedEmail } from '../src/lib/email.js';

export interface RemintArgs {
  sub: string;
  dryRun: boolean;
  newToken: boolean;
  to?: string;
}

export interface RemintDeps {
  db: Db;
  getLicense: (db: Db, subId: string) => Promise<License | null>;
  updateLicenseToken: (db: Db, id: string, token: string) => Promise<License>;
  mintToken: typeof mintToken;
  sendLicenseEmail: typeof sendLicenseEmail;
  resendApiKey: string;
  emailFrom: string;
  privateKeyHex: string;
}

export interface RemintResult {
  sent: boolean;
  preview?: RenderedEmail;
}

export function parseArgs(argv: string[]): RemintArgs {
  const out: Partial<RemintArgs> = { dryRun: false, newToken: false };
  for (const arg of argv) {
    if (arg.startsWith('--sub=')) out.sub = arg.slice('--sub='.length);
    else if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--new-token') out.newToken = true;
    else if (arg.startsWith('--to=')) out.to = arg.slice('--to='.length);
  }
  if (!out.sub) throw new Error('remint: --sub=<stripe_subscription_id> is required');
  return out as RemintArgs;
}

export async function runRemint(args: RemintArgs, deps: RemintDeps): Promise<RemintResult> {
  const license = await deps.getLicense(deps.db, args.sub);
  if (!license) throw new Error(`remint: no license found for subscription ${args.sub}`);
  if (license.revokedAt) {
    throw new Error(`remint: license is revoked (revoked_at=${license.revokedAt.toISOString()}); refusing to resend`);
  }

  let token = license.lastToken;
  if (args.newToken) {
    token = await deps.mintToken(
      {
        stripeCustomerId: license.stripeCustomerId,
        tier: license.tier as 'developer-seat' | 'app-deployment',
        seats: license.seats,
        expiresAt: license.expiresAt,
      },
      deps.privateKeyHex,
    );
    await deps.updateLicenseToken(deps.db, license.id, token);
  }

  const to = args.to ?? license.customerEmail;
  const vars = {
    tier: license.tier as 'developer-seat' | 'app-deployment',
    seats: license.seats,
    token,
    expiresAt: license.expiresAt,
  };

  if (args.dryRun) {
    return { sent: false, preview: renderLicenseEmail(vars) };
  }

  await deps.sendLicenseEmail({
    resendApiKey: deps.resendApiKey,
    from: deps.emailFrom,
    to,
    vars,
  });
  return { sent: true };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const env = loadEnv();
  const db = createDb(env.DATABASE_URL);
  try {
    const result = await runRemint(args, {
      db,
      getLicense,
      updateLicenseToken,
      mintToken,
      sendLicenseEmail,
      resendApiKey: env.RESEND_API_KEY,
      emailFrom: env.EMAIL_FROM,
      privateKeyHex: env.LICENSE_SIGNING_PRIVATE_KEY_HEX,
    });
    if (result.sent) {
      console.log(`Sent to ${args.to ?? '(license email)'} for subscription ${args.sub}`);
    } else if (result.preview) {
      console.log('--- DRY RUN ---');
      console.log('Subject:', result.preview.subject);
      console.log(result.preview.text);
    }
  } finally {
    await db.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
