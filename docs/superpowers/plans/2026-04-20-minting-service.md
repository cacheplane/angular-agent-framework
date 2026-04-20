# Minting Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Vercel serverless service that receives Stripe webhooks, mints signed Ed25519 license tokens, persists them to Postgres, and emails them to customers — plus a manual re-mint CLI.

**Architecture:** Stripe webhook → signature verify → idempotency check via `processed_events` table → dispatch by event type → tier extraction from price metadata → token signing via `@cacheplane/licensing` → UPSERT into `licenses` table → email via Resend. All orchestration lives in pure functions under `apps/minting-service/src/lib/`; schema and queries live in a shared `@cacheplane/db` lib so the website can reuse them later.

**Tech Stack:** TypeScript (NodeNext ESM), Nx monorepo, Drizzle ORM, Vercel Postgres, Stripe Node SDK, Resend SDK, `@noble/ed25519` (via `@cacheplane/licensing`), Vercel Node Serverless runtime, Jest, testcontainers (for integration tests).

**Spec:** `docs/superpowers/specs/2026-04-20-minting-service-design.md`

---

## File Structure

**Added to existing `libs/licensing/`:**
- `src/lib/sign-license.ts` — new `signLicense()` function wrapping `@noble/ed25519`
- `src/lib/sign-license.spec.ts`
- `src/index.ts` — export `signLicense`

**New lib `libs/db/` (`@cacheplane/db`):**
- `src/index.ts` — barrel
- `src/lib/client.ts` — `createDb(connectionString)` client factory
- `src/lib/schema/licenses.ts` — Drizzle table + types
- `src/lib/schema/processed-events.ts`
- `src/lib/schema/index.ts`
- `src/lib/queries/licenses.ts` — `upsertLicense`, `revokeLicense`, `getLicense`, `getLicensesByCustomerEmail`, `updateLicenseToken`
- `src/lib/queries/processed-events.ts` — `markEventProcessed`, `deleteProcessedEvent`
- `src/lib/queries/licenses.spec.ts`, `src/lib/queries/processed-events.spec.ts` (integration tests — real Postgres)
- `drizzle.config.ts`
- `drizzle/0000_init.sql` (generated)
- `project.json`, `package.json`, `tsconfig.*.json`

**New app `apps/minting-service/`:**
- `api/stripe-webhook.ts` — webhook entry point
- `api/health.ts` — health probe
- `src/lib/env.ts` — env var validation
- `src/lib/env.spec.ts`
- `src/lib/tier.ts` — `extractTier`, `computeSeats`
- `src/lib/tier.spec.ts`
- `src/lib/sign.ts` — `mintToken` wrapping `@cacheplane/licensing`'s `signLicense`
- `src/lib/sign.spec.ts`
- `src/lib/email.ts` — `renderLicenseEmail`, `sendLicenseEmail`
- `src/lib/email.spec.ts`
- `src/lib/handlers.ts` — `handleEvent`, `handleCheckoutCompleted`, `handleSubscriptionUpdated`, `handleSubscriptionDeleted`
- `src/lib/handlers.spec.ts`
- `src/lib/stripe.ts` — shared `Stripe` SDK singleton
- `scripts/remint.ts` — manual re-mint CLI
- `scripts/remint.spec.ts`
- `vercel.json`
- `.env.example`
- `README.md` — operator runbook
- `project.json`, `package.json`, `tsconfig.*.json`

---

## Phase A: Extend `@cacheplane/licensing` with signing

### Task 1: Add `signLicense()` to `@cacheplane/licensing`

**Files:**
- Create: `libs/licensing/src/lib/sign-license.ts`
- Create: `libs/licensing/src/lib/sign-license.spec.ts`
- Modify: `libs/licensing/src/index.ts` (add export)

**Context:** `@cacheplane/licensing` already ships `verifyLicense` (Ed25519 signature verify) and `parseLicenseToken`. The token format is `base64url(JSON-payload).base64url(ed25519-sig)`. We need a complementary `signLicense` so the minting service can produce tokens. Claims shape is already defined in `libs/licensing/src/lib/license-token.ts`:

```ts
export interface LicenseClaims {
  sub: string;        // Stripe customer id
  tier: LicenseTier;  // 'developer-seat' | 'app-deployment' | 'enterprise'
  iat: number;        // epoch seconds
  exp: number;        // epoch seconds
  seats: number;      // >= 1
}
```

- [ ] **Step 1: Write the failing test**

Create `libs/licensing/src/lib/sign-license.spec.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import * as ed from '@noble/ed25519';
import { signLicense } from './sign-license.js';
import { verifyLicense } from './verify-license.js';
import type { LicenseClaims } from './license-token.js';

describe('signLicense', () => {
  it('produces a token that verifyLicense accepts with the matching public key', async () => {
    const privateKey = ed.utils.randomPrivateKey();
    const publicKey = await ed.getPublicKeyAsync(privateKey);
    const claims: LicenseClaims = {
      sub: 'cus_test_123',
      tier: 'developer-seat',
      iat: 1_700_000_000,
      exp: 1_800_000_000,
      seats: 5,
    };

    const token = await signLicense(claims, privateKey);
    const result = await verifyLicense(token, publicKey);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.claims).toEqual(claims);
    }
  });

  it('produces a token with two base64url segments separated by a dot', async () => {
    const privateKey = ed.utils.randomPrivateKey();
    const claims: LicenseClaims = {
      sub: 'cus_abc',
      tier: 'app-deployment',
      iat: 1_700_000_000,
      exp: 1_800_000_000,
      seats: 1,
    };

    const token = await signLicense(claims, privateKey);
    const parts = token.split('.');

    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(parts[1]).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('tokens signed with different keys fail verification against the wrong key', async () => {
    const sk1 = ed.utils.randomPrivateKey();
    const sk2 = ed.utils.randomPrivateKey();
    const pk2 = await ed.getPublicKeyAsync(sk2);
    const claims: LicenseClaims = {
      sub: 'cus_x',
      tier: 'developer-seat',
      iat: 1_700_000_000,
      exp: 1_800_000_000,
      seats: 1,
    };

    const token = await signLicense(claims, sk1);
    const result = await verifyLicense(token, pk2);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('tampered');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /tmp/aaf-licensing && npx nx test licensing --testPathPattern=sign-license`
Expected: FAIL with "Cannot find module './sign-license.js'"

- [ ] **Step 3: Write minimal implementation**

Create `libs/licensing/src/lib/sign-license.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import * as ed from '@noble/ed25519';
import type { LicenseClaims } from './license-token.js';

function bytesToBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Sign license claims with an Ed25519 private key.
 * Returns a compact token of the form `<base64url(payload-json)>.<base64url(signature)>`,
 * compatible with {@link parseLicenseToken} and {@link verifyLicense}.
 */
export async function signLicense(
  claims: LicenseClaims,
  privateKey: Uint8Array,
): Promise<string> {
  const payloadJson = JSON.stringify(claims);
  const payloadBytes = new TextEncoder().encode(payloadJson);
  const signature = await ed.signAsync(payloadBytes, privateKey);
  return `${bytesToBase64Url(payloadBytes)}.${bytesToBase64Url(signature)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /tmp/aaf-licensing && npx nx test licensing --testPathPattern=sign-license`
Expected: PASS (3 tests)

- [ ] **Step 5: Export from barrel**

Modify `libs/licensing/src/index.ts` — add after the existing `runLicenseCheck` export:

```ts
export { signLicense } from './lib/sign-license.js';
```

- [ ] **Step 6: Verify build still works**

Run: `cd /tmp/aaf-licensing && npx nx build licensing`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
cd /tmp/aaf-licensing
git add libs/licensing/src/lib/sign-license.ts libs/licensing/src/lib/sign-license.spec.ts libs/licensing/src/index.ts
git commit -m "feat(licensing): add signLicense for minting signed license tokens"
```

---

## Phase B: `@cacheplane/db` library

### Task 2: Scaffold `@cacheplane/db` lib

**Files:**
- Create: `libs/db/project.json`
- Create: `libs/db/package.json`
- Create: `libs/db/tsconfig.json`
- Create: `libs/db/tsconfig.lib.json`
- Create: `libs/db/tsconfig.spec.json`
- Create: `libs/db/src/index.ts` (placeholder)
- Create: `libs/db/jest.config.ts`
- Create: `libs/db/eslint.config.mjs`
- Modify: `tsconfig.base.json` (add path alias)

**Context:** Follow the exact conventions of `libs/licensing` — that lib is a working reference for an `@nx/js:tsc`-built ESM Node lib in this monorepo. The key constraints established by prior licensing work:
- `module: NodeNext`, `moduleResolution: NodeNext` in `tsconfig.lib.json`
- `emitDeclarationOnly: false` must be set explicitly (tsconfig.base.json defaults it to true)
- Relative imports inside `src/` use `.js` extensions (required by Node ESM at runtime)

- [ ] **Step 1: Scaffold via Nx generator (non-interactive)**

Run:
```bash
cd /tmp/aaf-licensing
npx nx g @nx/js:lib libs/db --name=db --importPath=@cacheplane/db --bundler=tsc --linter=eslint --unitTestRunner=jest --no-interactive
```

Expected: creates `libs/db/` with scaffolded files.

- [ ] **Step 2: Verify TSConfig matches licensing's ESM setup**

Read `libs/licensing/tsconfig.lib.json`. Apply the same `compilerOptions` to `libs/db/tsconfig.lib.json`. Specifically ensure it contains:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc",
    "declaration": true,
    "emitDeclarationOnly": false
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.spec.ts", "jest.config.ts"]
}
```

- [ ] **Step 3: Verify `tsconfig.json` uses NodeNext**

Ensure `libs/db/tsconfig.json` has `module` and `moduleResolution` both set to `NodeNext` (matching `libs/licensing/tsconfig.json`). If the generator emitted different values, edit to match.

- [ ] **Step 4: Replace placeholder barrel**

Overwrite `libs/db/src/index.ts` with:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Barrel populated in later tasks.
export {};
```

- [ ] **Step 5: Verify path alias was added**

Open `tsconfig.base.json`. Confirm it contains an entry like:
```json
"@cacheplane/db": ["libs/db/src/index.ts"]
```
If missing, add it under `compilerOptions.paths`.

- [ ] **Step 6: Verify the lib builds, tests, and lints clean**

Run:
```bash
cd /tmp/aaf-licensing
npx nx build db && npx nx test db --passWithNoTests && npx nx lint db
```
Expected: all three PASS.

- [ ] **Step 7: Commit**

```bash
cd /tmp/aaf-licensing
git add libs/db tsconfig.base.json
git commit -m "feat(db): scaffold @cacheplane/db lib"
```

---

### Task 3: Add Drizzle dependencies and client factory

**Files:**
- Modify: `package.json` (add `drizzle-orm`, `postgres`, `drizzle-kit`)
- Modify: `libs/db/package.json` (add peer deps)
- Create: `libs/db/src/lib/client.ts`
- Create: `libs/db/src/lib/client.spec.ts`

**Context:** We're using the `postgres` driver (not `pg`) with Drizzle. Rationale: `postgres` has first-class ESM support, a smaller dependency footprint, and is the recommended driver in Drizzle docs for both Node and edge. Vercel Postgres' connection strings work identically with either driver.

- [ ] **Step 1: Add runtime and dev dependencies**

Run:
```bash
cd /tmp/aaf-licensing
pnpm add drizzle-orm postgres
pnpm add -D drizzle-kit
```

- [ ] **Step 2: Write the failing test for client factory**

Create `libs/db/src/lib/client.spec.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { createDb } from './client.js';

describe('createDb', () => {
  it('returns an object with a query builder and a connection closer', () => {
    const db = createDb('postgres://fake@localhost:5432/fake');
    expect(db).toBeDefined();
    expect(typeof db.close).toBe('function');
    // Close immediately — we're not actually connecting.
    return db.close();
  });

  it('throws if the connection string is empty', () => {
    expect(() => createDb('')).toThrow(/connection string/i);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `cd /tmp/aaf-licensing && npx nx test db --testPathPattern=client`
Expected: FAIL with "Cannot find module './client.js'"

- [ ] **Step 4: Implement the client factory**

Create `libs/db/src/lib/client.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

export type Db = ReturnType<typeof drizzle<typeof schema>> & {
  close: () => Promise<void>;
};

/**
 * Create a Drizzle client bound to the given Postgres connection string.
 * Caller is responsible for calling `close()` during shutdown.
 */
export function createDb(connectionString: string): Db {
  if (!connectionString) {
    throw new Error('createDb: connection string is required');
  }
  const sql = postgres(connectionString, { prepare: false });
  const db = drizzle(sql, { schema }) as Db;
  db.close = () => sql.end();
  return db;
}
```

- [ ] **Step 5: Create schema barrel stub**

Create `libs/db/src/lib/schema/index.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Populated in Tasks 4 & 5.
export {};
```

- [ ] **Step 6: Run tests — should pass**

Run: `cd /tmp/aaf-licensing && npx nx test db --testPathPattern=client`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
cd /tmp/aaf-licensing
git add package.json pnpm-lock.yaml libs/db/src/lib/client.ts libs/db/src/lib/client.spec.ts libs/db/src/lib/schema/index.ts libs/db/package.json
git commit -m "feat(db): add Drizzle client factory"
```

---

### Task 4: Define `licenses` table schema

**Files:**
- Create: `libs/db/src/lib/schema/licenses.ts`
- Modify: `libs/db/src/lib/schema/index.ts` (export)

- [ ] **Step 1: Implement schema**

Create `libs/db/src/lib/schema/licenses.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { pgTable, uuid, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const licenses = pgTable(
  'licenses',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    stripeCustomerId: text('stripe_customer_id').notNull(),
    stripeSubscriptionId: text('stripe_subscription_id').notNull().unique(),
    customerEmail: text('customer_email').notNull(),
    tier: text('tier').notNull(),
    seats: integer('seats').notNull(),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    lastToken: text('last_token').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    customerIdx: index('licenses_customer_idx').on(t.stripeCustomerId),
    emailIdx: index('licenses_email_idx').on(t.customerEmail),
  }),
);

export type License = typeof licenses.$inferSelect;
export type NewLicense = typeof licenses.$inferInsert;
```

- [ ] **Step 2: Export from schema barrel**

Replace `libs/db/src/lib/schema/index.ts` contents:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
export * from './licenses.js';
```

- [ ] **Step 3: Verify build**

Run: `cd /tmp/aaf-licensing && npx nx build db`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
cd /tmp/aaf-licensing
git add libs/db/src/lib/schema/
git commit -m "feat(db): add licenses table schema"
```

---

### Task 5: Define `processed_events` table schema

**Files:**
- Create: `libs/db/src/lib/schema/processed-events.ts`
- Modify: `libs/db/src/lib/schema/index.ts` (export)

- [ ] **Step 1: Implement schema**

Create `libs/db/src/lib/schema/processed-events.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const processedEvents = pgTable('processed_events', {
  stripeEventId: text('stripe_event_id').primaryKey(),
  eventType: text('event_type').notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ProcessedEvent = typeof processedEvents.$inferSelect;
export type NewProcessedEvent = typeof processedEvents.$inferInsert;
```

- [ ] **Step 2: Export from barrel**

Modify `libs/db/src/lib/schema/index.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
export * from './licenses.js';
export * from './processed-events.js';
```

- [ ] **Step 3: Verify build**

Run: `cd /tmp/aaf-licensing && npx nx build db`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
cd /tmp/aaf-licensing
git add libs/db/src/lib/schema/
git commit -m "feat(db): add processed_events table schema"
```

---

### Task 6: Configure drizzle-kit and generate initial migration

**Files:**
- Create: `libs/db/drizzle.config.ts`
- Create: `libs/db/drizzle/0000_init.sql` (generated)
- Modify: `libs/db/project.json` (add `db:generate` and `db:migrate` targets)

- [ ] **Step 1: Create drizzle config**

Create `libs/db/drizzle.config.ts`:

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/lib/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? '',
  },
});
```

- [ ] **Step 2: Add Nx targets**

Edit `libs/db/project.json`. Add these entries under `targets`:

```json
"db:generate": {
  "executor": "nx:run-commands",
  "options": {
    "command": "drizzle-kit generate",
    "cwd": "libs/db"
  }
},
"db:migrate": {
  "executor": "nx:run-commands",
  "options": {
    "command": "drizzle-kit migrate",
    "cwd": "libs/db"
  }
}
```

- [ ] **Step 3: Generate initial migration**

Run:
```bash
cd /tmp/aaf-licensing
npx nx run db:db:generate
```

This creates `libs/db/drizzle/0000_init.sql` and a metadata file in `libs/db/drizzle/meta/`.

- [ ] **Step 4: Verify migration SQL includes both tables**

Read `libs/db/drizzle/0000_init.sql`. Verify it contains `CREATE TABLE "licenses"` and `CREATE TABLE "processed_events"`. If the file is empty or missing either table, rerun Step 3 after checking that `libs/db/src/lib/schema/index.ts` exports both.

- [ ] **Step 5: Commit**

```bash
cd /tmp/aaf-licensing
git add libs/db/drizzle.config.ts libs/db/project.json libs/db/drizzle/
git commit -m "feat(db): configure drizzle-kit and generate initial migration"
```

---

### Task 7: Add testcontainers for integration tests

**Files:**
- Modify: `package.json` (add `@testcontainers/postgresql`, `testcontainers`)
- Create: `libs/db/src/lib/queries/test-helpers.ts`

**Context:** Query tests are integration tests (real Postgres). `testcontainers` spins up a disposable Postgres container per test file. This keeps tests hermetic and CI-friendly without requiring a pre-provisioned DB.

- [ ] **Step 1: Install dependencies**

Run:
```bash
cd /tmp/aaf-licensing
pnpm add -D testcontainers @testcontainers/postgresql
```

- [ ] **Step 2: Create shared test helpers**

Create `libs/db/src/lib/queries/test-helpers.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import * as path from 'node:path';
import * as schema from '../schema/index.js';

export interface TestDb {
  db: ReturnType<typeof drizzle<typeof schema>>;
  cleanup: () => Promise<void>;
}

/**
 * Spin up a disposable Postgres container, run migrations, and return a
 * Drizzle client plus a cleanup function. Call `cleanup` in afterAll.
 */
export async function startTestDb(): Promise<TestDb> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer('postgres:16').start();
  const sql = postgres(container.getConnectionUri(), { prepare: false });
  const db = drizzle(sql, { schema });

  const migrationsFolder = path.resolve(__dirname, '../../../drizzle');
  await migrate(db, { migrationsFolder });

  return {
    db,
    cleanup: async () => {
      await sql.end();
      await container.stop();
    },
  };
}
```

- [ ] **Step 3: Bump Jest test timeout for integration tests**

Check `libs/db/jest.config.ts`. If `testTimeout` is unset or less than 60000, add:
```ts
testTimeout: 60_000,
```
(Container startup can take 10-20 seconds on cold Docker.)

- [ ] **Step 4: Verify Docker availability is the only runtime requirement**

No code to run here — just confirm locally that `docker info` works. Document this in the lib README via Task 10.

- [ ] **Step 5: Commit**

```bash
cd /tmp/aaf-licensing
git add package.json pnpm-lock.yaml libs/db/src/lib/queries/test-helpers.ts libs/db/jest.config.ts
git commit -m "feat(db): add testcontainers-based integration test helpers"
```

---

### Task 8: Implement `processed-events` queries

**Files:**
- Create: `libs/db/src/lib/queries/processed-events.ts`
- Create: `libs/db/src/lib/queries/processed-events.spec.ts`
- Modify: `libs/db/src/index.ts` (export)

- [ ] **Step 1: Write the failing test**

Create `libs/db/src/lib/queries/processed-events.spec.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { markEventProcessed, deleteProcessedEvent } from './processed-events.js';
import { startTestDb, type TestDb } from './test-helpers.js';

describe('processed-events queries', () => {
  let testDb: TestDb;

  beforeAll(async () => {
    testDb = await startTestDb();
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  describe('markEventProcessed', () => {
    it('returns true on first insert of an event id', async () => {
      const result = await markEventProcessed(testDb.db, 'evt_first', 'checkout.session.completed');
      expect(result).toBe(true);
    });

    it('returns false on subsequent inserts of the same event id (idempotent)', async () => {
      await markEventProcessed(testDb.db, 'evt_dup', 'checkout.session.completed');
      const result = await markEventProcessed(testDb.db, 'evt_dup', 'checkout.session.completed');
      expect(result).toBe(false);
    });
  });

  describe('deleteProcessedEvent', () => {
    it('allows an event id to be reprocessed after deletion', async () => {
      await markEventProcessed(testDb.db, 'evt_retry', 'customer.subscription.updated');
      await deleteProcessedEvent(testDb.db, 'evt_retry');
      const result = await markEventProcessed(testDb.db, 'evt_retry', 'customer.subscription.updated');
      expect(result).toBe(true);
    });

    it('is a no-op when the event id does not exist', async () => {
      await expect(deleteProcessedEvent(testDb.db, 'evt_does_not_exist')).resolves.toBeUndefined();
    });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd /tmp/aaf-licensing && npx nx test db --testPathPattern=processed-events`
Expected: FAIL with "Cannot find module './processed-events.js'"

- [ ] **Step 3: Implement queries**

Create `libs/db/src/lib/queries/processed-events.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { eq } from 'drizzle-orm';
import type { Db } from '../client.js';
import { processedEvents } from '../schema/processed-events.js';

/**
 * Insert an event id. Returns `true` if this was the first time we saw it,
 * `false` if it was already recorded (Stripe retry).
 */
export async function markEventProcessed(
  db: Db,
  stripeEventId: string,
  eventType: string,
): Promise<boolean> {
  const rows = await db
    .insert(processedEvents)
    .values({ stripeEventId, eventType })
    .onConflictDoNothing({ target: processedEvents.stripeEventId })
    .returning({ id: processedEvents.stripeEventId });
  return rows.length > 0;
}

/**
 * Remove a processed-event marker. Used for compensating deletes when a
 * handler fails after the marker was written.
 */
export async function deleteProcessedEvent(db: Db, stripeEventId: string): Promise<void> {
  await db.delete(processedEvents).where(eq(processedEvents.stripeEventId, stripeEventId));
}
```

- [ ] **Step 4: Run tests — should pass**

Run: `cd /tmp/aaf-licensing && npx nx test db --testPathPattern=processed-events`
Expected: PASS (4 tests). First run may take ~20s for Docker image pull.

- [ ] **Step 5: Export from barrel**

Replace `libs/db/src/index.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
export { createDb } from './lib/client.js';
export type { Db } from './lib/client.js';
export * from './lib/schema/index.js';
export { markEventProcessed, deleteProcessedEvent } from './lib/queries/processed-events.js';
```

- [ ] **Step 6: Verify build**

Run: `cd /tmp/aaf-licensing && npx nx build db`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
cd /tmp/aaf-licensing
git add libs/db/src/lib/queries/processed-events.ts libs/db/src/lib/queries/processed-events.spec.ts libs/db/src/index.ts
git commit -m "feat(db): add processed-events queries with idempotency"
```

---

### Task 9: Implement `licenses` queries

**Files:**
- Create: `libs/db/src/lib/queries/licenses.ts`
- Create: `libs/db/src/lib/queries/licenses.spec.ts`
- Modify: `libs/db/src/index.ts` (export)

- [ ] **Step 1: Write the failing test**

Create `libs/db/src/lib/queries/licenses.spec.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  upsertLicense,
  getLicense,
  getLicensesByCustomerEmail,
  revokeLicense,
  updateLicenseToken,
} from './licenses.js';
import { startTestDb, type TestDb } from './test-helpers.js';

const base = {
  stripeCustomerId: 'cus_1',
  stripeSubscriptionId: 'sub_1',
  customerEmail: 'a@example.com',
  tier: 'developer-seat' as const,
  seats: 3,
  expiresAt: new Date('2027-01-01T00:00:00Z'),
  lastToken: 'token-v1',
};

describe('licenses queries', () => {
  let testDb: TestDb;

  beforeAll(async () => {
    testDb = await startTestDb();
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  describe('upsertLicense', () => {
    it('inserts a new row keyed on stripe_subscription_id', async () => {
      const row = await upsertLicense(testDb.db, { ...base, stripeSubscriptionId: 'sub_insert' });
      expect(row.stripeSubscriptionId).toBe('sub_insert');
      expect(row.seats).toBe(3);
      expect(row.id).toBeDefined();
    });

    it('updates an existing row on repeat sub id', async () => {
      await upsertLicense(testDb.db, { ...base, stripeSubscriptionId: 'sub_update', seats: 2 });
      const updated = await upsertLicense(testDb.db, {
        ...base,
        stripeSubscriptionId: 'sub_update',
        seats: 7,
        lastToken: 'token-v2',
      });
      expect(updated.seats).toBe(7);
      expect(updated.lastToken).toBe('token-v2');
    });
  });

  describe('getLicense', () => {
    it('returns the row when present', async () => {
      await upsertLicense(testDb.db, { ...base, stripeSubscriptionId: 'sub_get' });
      const found = await getLicense(testDb.db, 'sub_get');
      expect(found?.stripeSubscriptionId).toBe('sub_get');
    });

    it('returns null when not found', async () => {
      const found = await getLicense(testDb.db, 'sub_missing');
      expect(found).toBeNull();
    });
  });

  describe('getLicensesByCustomerEmail', () => {
    it('returns all rows matching the email', async () => {
      await upsertLicense(testDb.db, { ...base, stripeSubscriptionId: 'sub_e1', customerEmail: 'multi@example.com' });
      await upsertLicense(testDb.db, { ...base, stripeSubscriptionId: 'sub_e2', customerEmail: 'multi@example.com' });
      const rows = await getLicensesByCustomerEmail(testDb.db, 'multi@example.com');
      expect(rows.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('revokeLicense', () => {
    it('sets revoked_at to now', async () => {
      await upsertLicense(testDb.db, { ...base, stripeSubscriptionId: 'sub_revoke' });
      const revoked = await revokeLicense(testDb.db, 'sub_revoke');
      expect(revoked?.revokedAt).toBeInstanceOf(Date);
    });

    it('returns null for unknown subscription', async () => {
      const result = await revokeLicense(testDb.db, 'sub_missing_revoke');
      expect(result).toBeNull();
    });
  });

  describe('updateLicenseToken', () => {
    it('replaces last_token and bumps issued_at', async () => {
      const inserted = await upsertLicense(testDb.db, { ...base, stripeSubscriptionId: 'sub_token' });
      const before = inserted.issuedAt;
      await new Promise((r) => setTimeout(r, 10));
      const updated = await updateLicenseToken(testDb.db, inserted.id, 'token-v99');
      expect(updated.lastToken).toBe('token-v99');
      expect(updated.issuedAt.getTime()).toBeGreaterThan(before.getTime());
    });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd /tmp/aaf-licensing && npx nx test db --testPathPattern=queries/licenses`
Expected: FAIL with "Cannot find module './licenses.js'"

- [ ] **Step 3: Implement queries**

Create `libs/db/src/lib/queries/licenses.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { eq, sql } from 'drizzle-orm';
import type { Db } from '../client.js';
import { licenses, type License, type NewLicense } from '../schema/licenses.js';

export type UpsertLicenseInput = Omit<NewLicense, 'id' | 'createdAt' | 'updatedAt' | 'issuedAt'> & {
  id?: string;
};

/**
 * Insert a license or update the existing row keyed on stripe_subscription_id.
 * Bumps issued_at and updated_at on every call.
 */
export async function upsertLicense(db: Db, input: UpsertLicenseInput): Promise<License> {
  const now = new Date();
  const rows = await db
    .insert(licenses)
    .values({ ...input, issuedAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: licenses.stripeSubscriptionId,
      set: {
        customerEmail: input.customerEmail,
        tier: input.tier,
        seats: input.seats,
        expiresAt: input.expiresAt,
        lastToken: input.lastToken,
        issuedAt: now,
        updatedAt: now,
      },
    })
    .returning();
  return rows[0];
}

export async function getLicense(db: Db, stripeSubscriptionId: string): Promise<License | null> {
  const rows = await db
    .select()
    .from(licenses)
    .where(eq(licenses.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getLicensesByCustomerEmail(db: Db, email: string): Promise<License[]> {
  return db.select().from(licenses).where(eq(licenses.customerEmail, email));
}

export async function revokeLicense(db: Db, stripeSubscriptionId: string): Promise<License | null> {
  const rows = await db
    .update(licenses)
    .set({ revokedAt: sql`now()`, updatedAt: sql`now()` })
    .where(eq(licenses.stripeSubscriptionId, stripeSubscriptionId))
    .returning();
  return rows[0] ?? null;
}

export async function updateLicenseToken(db: Db, id: string, token: string): Promise<License> {
  const rows = await db
    .update(licenses)
    .set({ lastToken: token, issuedAt: sql`now()`, updatedAt: sql`now()` })
    .where(eq(licenses.id, id))
    .returning();
  if (!rows[0]) throw new Error(`updateLicenseToken: no license with id=${id}`);
  return rows[0];
}
```

- [ ] **Step 4: Run tests — should pass**

Run: `cd /tmp/aaf-licensing && npx nx test db --testPathPattern=queries/licenses`
Expected: PASS (8 tests).

- [ ] **Step 5: Export from barrel**

Replace `libs/db/src/index.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
export { createDb } from './lib/client.js';
export type { Db } from './lib/client.js';
export * from './lib/schema/index.js';
export { markEventProcessed, deleteProcessedEvent } from './lib/queries/processed-events.js';
export {
  upsertLicense,
  getLicense,
  getLicensesByCustomerEmail,
  revokeLicense,
  updateLicenseToken,
} from './lib/queries/licenses.js';
export type { UpsertLicenseInput } from './lib/queries/licenses.js';
```

- [ ] **Step 6: Verify build**

Run: `cd /tmp/aaf-licensing && npx nx build db`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
cd /tmp/aaf-licensing
git add libs/db/src/lib/queries/licenses.ts libs/db/src/lib/queries/licenses.spec.ts libs/db/src/index.ts
git commit -m "feat(db): add license queries (upsert, get, revoke, updateToken, byEmail)"
```

---

## Phase C: Scaffold `apps/minting-service/`

### Task 10: Scaffold Nx Node app

**Files:**
- Create: `apps/minting-service/project.json`
- Create: `apps/minting-service/package.json`
- Create: `apps/minting-service/tsconfig.json`
- Create: `apps/minting-service/tsconfig.app.json`
- Create: `apps/minting-service/tsconfig.spec.json`
- Create: `apps/minting-service/src/` (scaffolded)
- Create: `apps/minting-service/jest.config.ts`
- Create: `apps/minting-service/eslint.config.mjs`
- Modify: `tsconfig.base.json` (path alias if generator didn't add one)

- [ ] **Step 1: Scaffold via Nx generator**

Run:
```bash
cd /tmp/aaf-licensing
npx nx g @nx/node:app apps/minting-service --name=minting-service --framework=none --bundler=none --unitTestRunner=jest --e2eTestRunner=none --linter=eslint --no-interactive
```

Expected: creates `apps/minting-service/` scaffolded as a Node app.

- [ ] **Step 2: Remove generator's default `main.ts`**

Delete `apps/minting-service/src/main.ts` and any default `app/` directory the generator created — we don't need them; this app is driven by Vercel functions in `api/`.

Run:
```bash
cd /tmp/aaf-licensing
rm -rf apps/minting-service/src/app apps/minting-service/src/main.ts
```

- [ ] **Step 3: Align tsconfig to NodeNext ESM**

Open `apps/minting-service/tsconfig.app.json`. Ensure `compilerOptions` contains:

```json
{
  "module": "NodeNext",
  "moduleResolution": "NodeNext",
  "target": "ES2022",
  "outDir": "../../dist/apps/minting-service",
  "emitDeclarationOnly": false,
  "declaration": false
}
```

Keep `include`, `exclude`, and `extends` as generated; add `"api/**/*.ts"` to `include` if absent.

- [ ] **Step 4: Set package.json as ESM**

Open `apps/minting-service/package.json`. Ensure it contains:
```json
{
  "name": "@cacheplane/minting-service",
  "type": "module",
  "private": true,
  "version": "0.0.1"
}
```

- [ ] **Step 5: Verify lint and test targets work on an empty app**

Run:
```bash
cd /tmp/aaf-licensing
npx nx lint minting-service && npx nx test minting-service --passWithNoTests
```
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
cd /tmp/aaf-licensing
git add apps/minting-service tsconfig.base.json
git commit -m "feat(minting-service): scaffold Nx Node app"
```

---

### Task 11: Add runtime dependencies and `.env.example`

**Files:**
- Modify: `apps/minting-service/package.json` (add deps)
- Modify: `package.json` (add root deps if needed)
- Create: `apps/minting-service/.env.example`

- [ ] **Step 1: Install dependencies at the workspace root**

Run:
```bash
cd /tmp/aaf-licensing
pnpm add stripe resend
pnpm add -D tsx @types/node
```

- [ ] **Step 2: Declare workspace deps in app package.json**

Edit `apps/minting-service/package.json`. Add a `dependencies` block:

```json
"dependencies": {
  "@cacheplane/db": "workspace:*",
  "@cacheplane/licensing": "workspace:*",
  "stripe": "*",
  "resend": "*",
  "drizzle-orm": "*",
  "postgres": "*"
}
```

(The `"*"` versions defer to the root lockfile via pnpm workspace resolution.)

- [ ] **Step 3: Create `.env.example`**

Create `apps/minting-service/.env.example`:

```
# Stripe
STRIPE_SECRET_KEY=sk_test_replace_me
STRIPE_WEBHOOK_SECRET=whsec_replace_me

# Postgres (Vercel Postgres connection string)
DATABASE_URL=postgres://user:pass@host:5432/db?sslmode=require

# Resend
RESEND_API_KEY=re_replace_me
EMAIL_FROM=licenses@example.com

# License signing (64 hex chars, 32 bytes Ed25519 private key)
LICENSE_SIGNING_PRIVATE_KEY_HEX=0000000000000000000000000000000000000000000000000000000000000000

# Optional: fallback TTL when a subscription has no current_period_end
LICENSE_DEFAULT_TTL_DAYS=365
```

- [ ] **Step 4: Commit**

```bash
cd /tmp/aaf-licensing
git add apps/minting-service/package.json apps/minting-service/.env.example package.json pnpm-lock.yaml
git commit -m "feat(minting-service): add runtime deps and .env.example"
```

---

## Phase D: Pure modules (`src/lib/`)

### Task 12: Implement `env.ts` with validation

**Files:**
- Create: `apps/minting-service/src/lib/env.ts`
- Create: `apps/minting-service/src/lib/env.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/minting-service/src/lib/env.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify failure**

Run: `cd /tmp/aaf-licensing && npx nx test minting-service --testPathPattern=env`
Expected: FAIL with "Cannot find module './env.js'"

- [ ] **Step 3: Implement**

Create `apps/minting-service/src/lib/env.ts`:

```ts
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
```

- [ ] **Step 4: Run tests — should pass**

Run: `cd /tmp/aaf-licensing && npx nx test minting-service --testPathPattern=env`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
cd /tmp/aaf-licensing
git add apps/minting-service/src/lib/env.ts apps/minting-service/src/lib/env.spec.ts
git commit -m "feat(minting-service): add env var validation"
```

---

### Task 13: Implement `tier.ts`

**Files:**
- Create: `apps/minting-service/src/lib/tier.ts`
- Create: `apps/minting-service/src/lib/tier.spec.ts`

**Context:** Stripe prices carry `metadata.cacheplane_tier` — one of `'developer-seat'` or `'app-deployment'`. `extractTier` pulls it and validates; `computeSeats` enforces per-tier seat rules (developer-seat scales with quantity; app-deployment is always 1).

- [ ] **Step 1: Write the failing test**

Create `apps/minting-service/src/lib/tier.spec.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { extractTier, computeSeats } from './tier.js';

describe('extractTier', () => {
  it('returns developer-seat from price metadata', () => {
    expect(extractTier({ cacheplane_tier: 'developer-seat' })).toBe('developer-seat');
  });

  it('returns app-deployment from price metadata', () => {
    expect(extractTier({ cacheplane_tier: 'app-deployment' })).toBe('app-deployment');
  });

  it('throws when cacheplane_tier is missing', () => {
    expect(() => extractTier({})).toThrow(/cacheplane_tier/);
  });

  it('throws when cacheplane_tier is an unknown value', () => {
    expect(() => extractTier({ cacheplane_tier: 'bogus' })).toThrow(/bogus/);
  });

  it('throws when metadata is null', () => {
    expect(() => extractTier(null)).toThrow(/metadata/);
  });
});

describe('computeSeats', () => {
  it('returns the Stripe quantity for developer-seat', () => {
    expect(computeSeats('developer-seat', 5)).toBe(5);
  });

  it('returns 1 for app-deployment regardless of quantity', () => {
    expect(computeSeats('app-deployment', 10)).toBe(1);
  });

  it('defaults developer-seat to 1 when quantity is null', () => {
    expect(computeSeats('developer-seat', null)).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd /tmp/aaf-licensing && npx nx test minting-service --testPathPattern=tier`
Expected: FAIL with "Cannot find module './tier.js'"

- [ ] **Step 3: Implement**

Create `apps/minting-service/src/lib/tier.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { LicenseTier } from '@cacheplane/licensing';

export type MintableTier = Extract<LicenseTier, 'developer-seat' | 'app-deployment'>;

const VALID_TIERS: readonly MintableTier[] = ['developer-seat', 'app-deployment'] as const;

/**
 * Extract the Cacheplane tier from a Stripe price metadata bag.
 * Throws if the field is missing or holds an unknown value.
 */
export function extractTier(metadata: Record<string, string> | null | undefined): MintableTier {
  if (!metadata) {
    throw new Error('extractTier: price metadata is missing');
  }
  const raw = metadata['cacheplane_tier'];
  if (!raw) {
    throw new Error('extractTier: metadata.cacheplane_tier is missing');
  }
  if (!VALID_TIERS.includes(raw as MintableTier)) {
    throw new Error(`extractTier: unknown cacheplane_tier value: ${raw}`);
  }
  return raw as MintableTier;
}

/**
 * Compute the `seats` claim from the Stripe line-item quantity.
 * - developer-seat: tracks Stripe quantity (minimum 1).
 * - app-deployment: always 1.
 */
export function computeSeats(tier: MintableTier, quantity: number | null | undefined): number {
  if (tier === 'app-deployment') return 1;
  return quantity && quantity > 0 ? quantity : 1;
}
```

- [ ] **Step 4: Run tests — should pass**

Run: `cd /tmp/aaf-licensing && npx nx test minting-service --testPathPattern=tier`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
cd /tmp/aaf-licensing
git add apps/minting-service/src/lib/tier.ts apps/minting-service/src/lib/tier.spec.ts
git commit -m "feat(minting-service): add tier extraction and seat computation"
```

---

### Task 14: Implement `sign.ts` — `mintToken` wrapping `@cacheplane/licensing`

**Files:**
- Create: `apps/minting-service/src/lib/sign.ts`
- Create: `apps/minting-service/src/lib/sign.spec.ts`

**Context:** `mintToken` takes domain-friendly inputs (customer id, tier, seats, expiry as a Date) and a hex-encoded private key, and returns a signed token. It converts the Date to epoch seconds and fills in `iat`.

- [ ] **Step 1: Write the failing test**

Create `apps/minting-service/src/lib/sign.spec.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import * as ed from '@noble/ed25519';
import { verifyLicense } from '@cacheplane/licensing';
import { mintToken } from './sign.js';

async function makeKeypair() {
  const sk = ed.utils.randomPrivateKey();
  const pk = await ed.getPublicKeyAsync(sk);
  return {
    skHex: Buffer.from(sk).toString('hex'),
    pk,
  };
}

describe('mintToken', () => {
  it('returns a token verifiable with the matching public key', async () => {
    const { skHex, pk } = await makeKeypair();

    const token = await mintToken(
      {
        stripeCustomerId: 'cus_abc',
        tier: 'developer-seat',
        seats: 3,
        expiresAt: new Date('2027-01-01T00:00:00Z'),
      },
      skHex,
    );

    const result = await verifyLicense(token, pk);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.claims.sub).toBe('cus_abc');
      expect(result.claims.tier).toBe('developer-seat');
      expect(result.claims.seats).toBe(3);
      expect(result.claims.exp).toBe(Math.floor(new Date('2027-01-01T00:00:00Z').getTime() / 1000));
      expect(result.claims.iat).toBeGreaterThan(0);
    }
  });

  it('throws if the private key hex is malformed', async () => {
    await expect(
      mintToken(
        {
          stripeCustomerId: 'cus_x',
          tier: 'app-deployment',
          seats: 1,
          expiresAt: new Date('2027-01-01T00:00:00Z'),
        },
        'not-hex',
      ),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd /tmp/aaf-licensing && npx nx test minting-service --testPathPattern=sign`
Expected: FAIL with "Cannot find module './sign.js'"

- [ ] **Step 3: Implement**

Create `apps/minting-service/src/lib/sign.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { signLicense, type LicenseClaims } from '@cacheplane/licensing';
import type { MintableTier } from './tier.js';

export interface MintInput {
  stripeCustomerId: string;
  tier: MintableTier;
  seats: number;
  expiresAt: Date;
}

/**
 * Mint a signed license token. `privateKeyHex` is a 64-char hex string
 * encoding a 32-byte Ed25519 private key.
 */
export async function mintToken(input: MintInput, privateKeyHex: string): Promise<string> {
  const privateKey = hexToBytes(privateKeyHex);
  const now = Math.floor(Date.now() / 1000);
  const claims: LicenseClaims = {
    sub: input.stripeCustomerId,
    tier: input.tier,
    iat: now,
    exp: Math.floor(input.expiresAt.getTime() / 1000),
    seats: input.seats,
  };
  return signLicense(claims, privateKey);
}

function hexToBytes(hex: string): Uint8Array {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) {
    throw new Error('mintToken: privateKeyHex must be an even-length hex string');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
```

- [ ] **Step 4: Run tests — should pass**

Run: `cd /tmp/aaf-licensing && npx nx test minting-service --testPathPattern=sign`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd /tmp/aaf-licensing
git add apps/minting-service/src/lib/sign.ts apps/minting-service/src/lib/sign.spec.ts
git commit -m "feat(minting-service): add mintToken wrapper over @cacheplane/licensing"
```

---

### Task 15: Implement `email.ts` rendering (pure)

**Files:**
- Create: `apps/minting-service/src/lib/email.ts`
- Create: `apps/minting-service/src/lib/email.spec.ts`

**Context:** `renderLicenseEmail` is pure (no Resend, no network) so we can snapshot-test the body. `sendLicenseEmail` is the Resend wrapper and is covered by handler-level mocks.

- [ ] **Step 1: Write the failing test**

Create `apps/minting-service/src/lib/email.spec.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { renderLicenseEmail } from './email.js';

describe('renderLicenseEmail', () => {
  it('includes the token wrapped in BEGIN/END delimiters in the text body', () => {
    const out = renderLicenseEmail({
      tier: 'developer-seat',
      seats: 3,
      token: 'PAYLOAD.SIG',
      expiresAt: new Date('2027-04-20T00:00:00Z'),
    });

    expect(out.text).toContain('-----BEGIN CACHEPLANE LICENSE-----');
    expect(out.text).toContain('PAYLOAD.SIG');
    expect(out.text).toContain('-----END CACHEPLANE LICENSE-----');
  });

  it('subject includes tier and seat count with plural s for seats > 1', () => {
    const out = renderLicenseEmail({
      tier: 'developer-seat',
      seats: 3,
      token: 't.s',
      expiresAt: new Date('2027-04-20T00:00:00Z'),
    });
    expect(out.subject).toBe('Your Cacheplane license — developer-seat (3 seats)');
  });

  it('subject uses singular seat for seats === 1', () => {
    const out = renderLicenseEmail({
      tier: 'app-deployment',
      seats: 1,
      token: 't.s',
      expiresAt: new Date('2027-04-20T00:00:00Z'),
    });
    expect(out.subject).toBe('Your Cacheplane license — app-deployment (1 seat)');
  });

  it('includes ISO 8601 UTC expiry in text body', () => {
    const out = renderLicenseEmail({
      tier: 'developer-seat',
      seats: 1,
      token: 't.s',
      expiresAt: new Date('2027-04-20T00:00:00Z'),
    });
    expect(out.text).toContain('Expires: 2027-04-20T00:00:00.000Z');
  });

  it('html body wraps the token in a monospace pre block', () => {
    const out = renderLicenseEmail({
      tier: 'developer-seat',
      seats: 1,
      token: 'PAYLOAD.SIG',
      expiresAt: new Date('2027-04-20T00:00:00Z'),
    });
    expect(out.html).toContain('<pre');
    expect(out.html).toContain('PAYLOAD.SIG');
    expect(out.html).toContain('BEGIN CACHEPLANE LICENSE');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd /tmp/aaf-licensing && npx nx test minting-service --testPathPattern=email`
Expected: FAIL with "Cannot find module './email.js'"

- [ ] **Step 3: Implement rendering**

Create `apps/minting-service/src/lib/email.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Resend } from 'resend';
import type { MintableTier } from './tier.js';

export interface LicenseEmailVars {
  tier: MintableTier;
  seats: number;
  token: string;
  expiresAt: Date;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

/**
 * Pure: render the subject / text / html for a license delivery email.
 */
export function renderLicenseEmail(vars: LicenseEmailVars): RenderedEmail {
  const seatWord = vars.seats === 1 ? 'seat' : 'seats';
  const subject = `Your Cacheplane license — ${vars.tier} (${vars.seats} ${seatWord})`;
  const expiresIso = vars.expiresAt.toISOString();

  const text = `Thanks for subscribing to Cacheplane.

Your license token is below. Set it as the CACHEPLANE_LICENSE
environment variable in your application:

-----BEGIN CACHEPLANE LICENSE-----
${vars.token}
-----END CACHEPLANE LICENSE-----

Tier: ${vars.tier}
Seats: ${vars.seats}
Expires: ${expiresIso}

Installation:
  export CACHEPLANE_LICENSE="<paste token above>"

Or in a .env file:
  CACHEPLANE_LICENSE=<paste token above>

Docs: https://cacheplane.dev/docs/licensing
Questions: reply to this email.

-- The Cacheplane team
`;

  const html = `<p>Thanks for subscribing to Cacheplane.</p>
<p>Your license token is below. Set it as the <code>CACHEPLANE_LICENSE</code> environment variable in your application:</p>
<pre style="white-space:pre-wrap;word-break:break-all;font-family:monospace;font-size:12px;background:#f4f4f4;padding:12px;border-radius:4px">-----BEGIN CACHEPLANE LICENSE-----
${escapeHtml(vars.token)}
-----END CACHEPLANE LICENSE-----</pre>
<p><strong>Tier:</strong> ${escapeHtml(vars.tier)}<br>
<strong>Seats:</strong> ${vars.seats}<br>
<strong>Expires:</strong> ${escapeHtml(expiresIso)}</p>
<p><strong>Installation:</strong></p>
<pre style="font-family:monospace;font-size:12px;background:#f4f4f4;padding:12px;border-radius:4px">export CACHEPLANE_LICENSE="&lt;paste token above&gt;"</pre>
<p>Docs: <a href="https://cacheplane.dev/docs/licensing">cacheplane.dev/docs/licensing</a><br>
Questions: reply to this email.</p>
<p>-- The Cacheplane team</p>
`;

  return { subject, text, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Send a license email via Resend. Throws on Resend errors so the caller
 * (webhook handler) can fail the request and trigger Stripe retry.
 */
export async function sendLicenseEmail(args: {
  resendApiKey: string;
  from: string;
  to: string;
  vars: LicenseEmailVars;
}): Promise<{ resendId: string }> {
  const resend = new Resend(args.resendApiKey);
  const rendered = renderLicenseEmail(args.vars);
  const result = await resend.emails.send({
    from: args.from,
    to: args.to,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
  });
  if (result.error) {
    throw new Error(`Resend send failed: ${result.error.message}`);
  }
  if (!result.data?.id) {
    throw new Error('Resend send returned no id');
  }
  return { resendId: result.data.id };
}
```

- [ ] **Step 4: Run tests — should pass**

Run: `cd /tmp/aaf-licensing && npx nx test minting-service --testPathPattern=email`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
cd /tmp/aaf-licensing
git add apps/minting-service/src/lib/email.ts apps/minting-service/src/lib/email.spec.ts
git commit -m "feat(minting-service): add license email renderer and Resend wrapper"
```

---

## Phase E: Handlers

### Task 16: Add `stripe.ts` — shared Stripe SDK singleton

**Files:**
- Create: `apps/minting-service/src/lib/stripe.ts`

- [ ] **Step 1: Implement**

Create `apps/minting-service/src/lib/stripe.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import Stripe from 'stripe';

let client: Stripe | null = null;

/**
 * Lazy-init a Stripe SDK client. Lives in its own module so tests can
 * replace it via jest.mock without the full env being loaded.
 */
export function getStripe(apiKey: string): Stripe {
  if (!client) {
    client = new Stripe(apiKey, { apiVersion: '2024-06-20' });
  }
  return client;
}
```

- [ ] **Step 2: Verify build**

Run: `cd /tmp/aaf-licensing && npx nx build minting-service`
Expected: PASS (or if no build target exists, run `npx tsc --noEmit -p apps/minting-service/tsconfig.app.json`).

- [ ] **Step 3: Commit**

```bash
cd /tmp/aaf-licensing
git add apps/minting-service/src/lib/stripe.ts
git commit -m "feat(minting-service): add Stripe SDK singleton"
```

---

### Task 17: Implement `handlers.ts` — idempotency + dispatch skeleton

**Files:**
- Create: `apps/minting-service/src/lib/handlers.ts`
- Create: `apps/minting-service/src/lib/handlers.spec.ts`

**Context:** We build handlers in layers. This task covers the `handleEvent` orchestrator (idempotency check, dispatch, compensating delete on error) plus the three handler stubs. Subsequent tasks (18, 19, 20) fill in each handler with tests.

- [ ] **Step 1: Write the failing test for idempotency + dispatch**

Create `apps/minting-service/src/lib/handlers.spec.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type Stripe from 'stripe';
import { handleEvent, type HandlerDeps } from './handlers.js';

function makeDeps(overrides: Partial<HandlerDeps> = {}): HandlerDeps {
  return {
    db: {} as any,
    stripe: {} as any,
    markEventProcessed: jest.fn().mockResolvedValue(true),
    deleteProcessedEvent: jest.fn().mockResolvedValue(undefined),
    upsertLicense: jest.fn(),
    getLicense: jest.fn(),
    revokeLicense: jest.fn(),
    mintToken: jest.fn(),
    sendLicenseEmail: jest.fn(),
    privateKeyHex: 'a'.repeat(64),
    resendApiKey: 're_test',
    emailFrom: 'a@b.c',
    defaultTtlDays: 365,
    ...overrides,
  };
}

function evt(type: string, obj: unknown = {}): Stripe.Event {
  return { id: `evt_${type}`, type, data: { object: obj } } as Stripe.Event;
}

describe('handleEvent', () => {
  it('returns early if markEventProcessed returns false (duplicate)', async () => {
    const deps = makeDeps({
      markEventProcessed: jest.fn().mockResolvedValue(false),
    });
    await handleEvent(evt('customer.subscription.deleted', { id: 'sub_x' }), deps);
    expect(deps.revokeLicense).not.toHaveBeenCalled();
  });

  it('no-ops on unknown event types', async () => {
    const deps = makeDeps();
    await handleEvent(evt('invoice.payment_succeeded'), deps);
    expect(deps.revokeLicense).not.toHaveBeenCalled();
    expect(deps.upsertLicense).not.toHaveBeenCalled();
  });

  it('compensating-deletes the processed-event marker when handler throws', async () => {
    const boom = new Error('boom');
    const deps = makeDeps({
      revokeLicense: jest.fn().mockRejectedValue(boom),
    });
    await expect(
      handleEvent(evt('customer.subscription.deleted', { id: 'sub_boom' }), deps),
    ).rejects.toBe(boom);
    expect(deps.deleteProcessedEvent).toHaveBeenCalledWith(deps.db, 'evt_customer.subscription.deleted');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd /tmp/aaf-licensing && npx nx test minting-service --testPathPattern=handlers`
Expected: FAIL with "Cannot find module './handlers.js'"

- [ ] **Step 3: Implement skeleton**

Create `apps/minting-service/src/lib/handlers.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type Stripe from 'stripe';
import type {
  Db,
  License,
  UpsertLicenseInput,
} from '@cacheplane/db';
import type { MintInput } from './sign.js';
import type { LicenseEmailVars } from './email.js';

/**
 * All external collaborators are injected so handlers are unit-testable.
 */
export interface HandlerDeps {
  db: Db;
  stripe: Stripe;
  markEventProcessed: (db: Db, id: string, type: string) => Promise<boolean>;
  deleteProcessedEvent: (db: Db, id: string) => Promise<void>;
  upsertLicense: (db: Db, input: UpsertLicenseInput) => Promise<License>;
  getLicense: (db: Db, subId: string) => Promise<License | null>;
  revokeLicense: (db: Db, subId: string) => Promise<License | null>;
  mintToken: (input: MintInput, privateKeyHex: string) => Promise<string>;
  sendLicenseEmail: (args: {
    resendApiKey: string;
    from: string;
    to: string;
    vars: LicenseEmailVars;
  }) => Promise<{ resendId: string }>;
  privateKeyHex: string;
  resendApiKey: string;
  emailFrom: string;
  defaultTtlDays: number;
}

export async function handleEvent(event: Stripe.Event, deps: HandlerDeps): Promise<void> {
  const firstTime = await deps.markEventProcessed(deps.db, event.id, event.type);
  if (!firstTime) return;

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, deps);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, deps);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, deps);
        break;
      default:
        return;
    }
  } catch (err) {
    await deps.deleteProcessedEvent(deps.db, event.id);
    throw err;
  }
}

export async function handleCheckoutCompleted(
  _session: Stripe.Checkout.Session,
  _deps: HandlerDeps,
): Promise<void> {
  throw new Error('handleCheckoutCompleted: not yet implemented');
}

export async function handleSubscriptionUpdated(
  _sub: Stripe.Subscription,
  _deps: HandlerDeps,
): Promise<void> {
  throw new Error('handleSubscriptionUpdated: not yet implemented');
}

export async function handleSubscriptionDeleted(
  sub: Stripe.Subscription,
  deps: HandlerDeps,
): Promise<void> {
  await deps.revokeLicense(deps.db, sub.id);
}
```

- [ ] **Step 4: Run tests — should pass**

Run: `cd /tmp/aaf-licensing && npx nx test minting-service --testPathPattern=handlers`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd /tmp/aaf-licensing
git add apps/minting-service/src/lib/handlers.ts apps/minting-service/src/lib/handlers.spec.ts
git commit -m "feat(minting-service): add handleEvent dispatcher with idempotency + compensating delete"
```

---

### Task 18: Implement `handleCheckoutCompleted`

**Files:**
- Modify: `apps/minting-service/src/lib/handlers.ts`
- Modify: `apps/minting-service/src/lib/handlers.spec.ts`

**Context:** The session object in `checkout.session.completed` doesn't include line items by default. We call `stripe.checkout.sessions.retrieve(id, { expand: ['line_items.data.price'] })` to get them, then extract tier, seats, and expiry from the subscription's `current_period_end`.

- [ ] **Step 1: Add failing tests**

Append to `apps/minting-service/src/lib/handlers.spec.ts` (inside the existing file, after the `describe('handleEvent', ...)` block):

```ts
describe('handleCheckoutCompleted', () => {
  function baseSession(overrides: any = {}): Stripe.Checkout.Session {
    return {
      id: 'cs_test',
      customer: 'cus_x',
      subscription: 'sub_x',
      customer_details: { email: 'a@b.c' },
      ...overrides,
    } as Stripe.Checkout.Session;
  }

  function baseDeps(): HandlerDeps {
    const lineItem = {
      data: [
        {
          quantity: 2,
          price: { metadata: { cacheplane_tier: 'developer-seat' } },
        },
      ],
    };
    const sub = { current_period_end: 1_800_000_000, id: 'sub_x' };
    const expandedSession = baseSession({ line_items: lineItem });

    return makeDeps({
      stripe: {
        checkout: {
          sessions: {
            retrieve: jest.fn().mockResolvedValue(expandedSession),
          },
        },
        subscriptions: {
          retrieve: jest.fn().mockResolvedValue(sub),
        },
      } as any,
      mintToken: jest.fn().mockResolvedValue('TOKEN.SIG'),
      upsertLicense: jest.fn().mockImplementation((_db, input) =>
        Promise.resolve({ ...input, id: 'lic_1', createdAt: new Date(), updatedAt: new Date(), issuedAt: new Date(), revokedAt: null }),
      ),
      sendLicenseEmail: jest.fn().mockResolvedValue({ resendId: 're_1' }),
    });
  }

  it('upserts a license row and sends an email', async () => {
    const deps = baseDeps();
    await handleEvent(
      { id: 'evt_co', type: 'checkout.session.completed', data: { object: baseSession() } } as Stripe.Event,
      deps,
    );
    expect(deps.upsertLicense).toHaveBeenCalledTimes(1);
    const upsertArg = (deps.upsertLicense as jest.Mock).mock.calls[0][1];
    expect(upsertArg.stripeSubscriptionId).toBe('sub_x');
    expect(upsertArg.tier).toBe('developer-seat');
    expect(upsertArg.seats).toBe(2);
    expect(upsertArg.customerEmail).toBe('a@b.c');
    expect(upsertArg.lastToken).toBe('TOKEN.SIG');
    expect(deps.sendLicenseEmail).toHaveBeenCalledTimes(1);
  });

  it('throws when cacheplane_tier is missing from price metadata', async () => {
    const deps = baseDeps();
    (deps.stripe.checkout.sessions.retrieve as jest.Mock).mockResolvedValueOnce(
      baseSession({ line_items: { data: [{ quantity: 1, price: { metadata: {} } }] } }),
    );
    await expect(
      handleEvent(
        { id: 'evt_co2', type: 'checkout.session.completed', data: { object: baseSession() } } as Stripe.Event,
        deps,
      ),
    ).rejects.toThrow(/cacheplane_tier/);
    expect(deps.deleteProcessedEvent).toHaveBeenCalledWith(deps.db, 'evt_co2');
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `cd /tmp/aaf-licensing && npx nx test minting-service --testPathPattern=handlers`
Expected: 2 new tests FAIL with "handleCheckoutCompleted: not yet implemented"

- [ ] **Step 3: Implement `handleCheckoutCompleted`**

In `apps/minting-service/src/lib/handlers.ts`, replace the stub:

```ts
import { extractTier, computeSeats } from './tier.js';

export async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  deps: HandlerDeps,
): Promise<void> {
  const expanded = await deps.stripe.checkout.sessions.retrieve(session.id, {
    expand: ['line_items.data.price'],
  });
  const lineItem = expanded.line_items?.data?.[0];
  if (!lineItem) {
    throw new Error(`handleCheckoutCompleted: session ${session.id} has no line items`);
  }
  const priceMetadata = (lineItem.price?.metadata ?? {}) as Record<string, string>;
  const tier = extractTier(priceMetadata);
  const seats = computeSeats(tier, lineItem.quantity);

  const subId = typeof expanded.subscription === 'string'
    ? expanded.subscription
    : expanded.subscription?.id;
  if (!subId) {
    throw new Error(`handleCheckoutCompleted: session ${session.id} has no subscription`);
  }
  const sub = await deps.stripe.subscriptions.retrieve(subId);
  const expiresAt = sub.current_period_end
    ? new Date(sub.current_period_end * 1000)
    : new Date(Date.now() + deps.defaultTtlDays * 24 * 60 * 60 * 1000);

  const customerId = typeof expanded.customer === 'string' ? expanded.customer : expanded.customer?.id;
  if (!customerId) {
    throw new Error(`handleCheckoutCompleted: session ${session.id} has no customer`);
  }
  const email = expanded.customer_details?.email;
  if (!email) {
    throw new Error(`handleCheckoutCompleted: session ${session.id} has no customer email`);
  }

  const token = await deps.mintToken(
    { stripeCustomerId: customerId, tier, seats, expiresAt },
    deps.privateKeyHex,
  );

  await deps.upsertLicense(deps.db, {
    stripeCustomerId: customerId,
    stripeSubscriptionId: subId,
    customerEmail: email,
    tier,
    seats,
    expiresAt,
    lastToken: token,
  });

  await deps.sendLicenseEmail({
    resendApiKey: deps.resendApiKey,
    from: deps.emailFrom,
    to: email,
    vars: { tier, seats, token, expiresAt },
  });
}
```

- [ ] **Step 4: Run tests — all should pass**

Run: `cd /tmp/aaf-licensing && npx nx test minting-service --testPathPattern=handlers`
Expected: PASS (5 tests now).

- [ ] **Step 5: Commit**

```bash
cd /tmp/aaf-licensing
git add apps/minting-service/src/lib/handlers.ts apps/minting-service/src/lib/handlers.spec.ts
git commit -m "feat(minting-service): implement handleCheckoutCompleted"
```

---

### Task 19: Implement `handleSubscriptionUpdated` with material-change check

**Files:**
- Modify: `apps/minting-service/src/lib/handlers.ts`
- Modify: `apps/minting-service/src/lib/handlers.spec.ts`

**Context:** Stripe fires `customer.subscription.updated` for any mutation (card change, metadata edit, period renewal, plan change). We only want to mint a new token and email the customer when the claims shape changes — i.e. tier, seats, or expiry differs.

- [ ] **Step 1: Add failing tests**

Append to `apps/minting-service/src/lib/handlers.spec.ts`:

```ts
describe('handleSubscriptionUpdated', () => {
  function sub(overrides: any = {}): Stripe.Subscription {
    return {
      id: 'sub_u',
      customer: 'cus_u',
      current_period_end: 1_800_000_000,
      items: {
        data: [
          {
            quantity: 3,
            price: { metadata: { cacheplane_tier: 'developer-seat' } },
          },
        ],
      },
      ...overrides,
    } as Stripe.Subscription;
  }

  function existingLicense(overrides: Partial<License> = {}): License {
    return {
      id: 'lic_u',
      stripeCustomerId: 'cus_u',
      stripeSubscriptionId: 'sub_u',
      customerEmail: 'u@example.com',
      tier: 'developer-seat',
      seats: 3,
      expiresAt: new Date(1_800_000_000 * 1000),
      revokedAt: null,
      lastToken: 'OLD.TOKEN',
      issuedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    } as License;
  }

  function deps(license: License | null): HandlerDeps {
    return makeDeps({
      getLicense: jest.fn().mockResolvedValue(license),
      upsertLicense: jest.fn().mockImplementation((_db, input) =>
        Promise.resolve({ ...(license ?? {}), ...input, id: 'lic_u', createdAt: new Date(), updatedAt: new Date(), issuedAt: new Date(), revokedAt: null }),
      ),
      mintToken: jest.fn().mockResolvedValue('NEW.TOKEN'),
      sendLicenseEmail: jest.fn().mockResolvedValue({ resendId: 're_u' }),
      stripe: {
        checkout: { sessions: { retrieve: jest.fn() } },
        subscriptions: { retrieve: jest.fn() },
      } as any,
    });
  }

  it('upserts without minting or emailing when claims are unchanged', async () => {
    const d = deps(existingLicense());
    // Customer email from existing license must match current Stripe data —
    // use the license email for the existing row to make the claim comparison clean.
    await handleEvent(
      { id: 'evt_u_noop', type: 'customer.subscription.updated', data: { object: sub() } } as Stripe.Event,
      d,
    );
    expect(d.mintToken).not.toHaveBeenCalled();
    expect(d.sendLicenseEmail).not.toHaveBeenCalled();
    expect(d.upsertLicense).toHaveBeenCalledTimes(1);
    const arg = (d.upsertLicense as jest.Mock).mock.calls[0][1];
    expect(arg.lastToken).toBe('OLD.TOKEN');
  });

  it('mints and emails when seats change', async () => {
    const d = deps(existingLicense({ seats: 2 }));
    await handleEvent(
      { id: 'evt_u_seats', type: 'customer.subscription.updated', data: { object: sub() } } as Stripe.Event,
      d,
    );
    expect(d.mintToken).toHaveBeenCalledTimes(1);
    expect(d.sendLicenseEmail).toHaveBeenCalledTimes(1);
    const arg = (d.upsertLicense as jest.Mock).mock.calls[0][1];
    expect(arg.lastToken).toBe('NEW.TOKEN');
    expect(arg.seats).toBe(3);
  });

  it('mints and emails when tier changes', async () => {
    const d = deps(existingLicense({ tier: 'app-deployment', seats: 1 }));
    await handleEvent(
      { id: 'evt_u_tier', type: 'customer.subscription.updated', data: { object: sub() } } as Stripe.Event,
      d,
    );
    expect(d.mintToken).toHaveBeenCalledTimes(1);
    expect(d.sendLicenseEmail).toHaveBeenCalledTimes(1);
  });

  it('mints and emails when expires_at changes', async () => {
    const d = deps(existingLicense({ expiresAt: new Date(1_700_000_000 * 1000) }));
    await handleEvent(
      { id: 'evt_u_exp', type: 'customer.subscription.updated', data: { object: sub() } } as Stripe.Event,
      d,
    );
    expect(d.mintToken).toHaveBeenCalledTimes(1);
    expect(d.sendLicenseEmail).toHaveBeenCalledTimes(1);
  });

  it('mints and emails when no existing license is found (first time)', async () => {
    const d = deps(null);
    // Need customer retrieval for email — emulate a Stripe customer lookup.
    (d.stripe.subscriptions.retrieve as jest.Mock) = jest.fn().mockResolvedValue({ latest_invoice: null });
    // Test expects an email source. The implementation pulls it from the license if present, otherwise from subscription metadata or Stripe customer.
    // Emulate customer retrieval for emails:
    (d.stripe as any).customers = {
      retrieve: jest.fn().mockResolvedValue({ email: 'new@example.com' }),
    };
    await handleEvent(
      { id: 'evt_u_new', type: 'customer.subscription.updated', data: { object: sub() } } as Stripe.Event,
      d,
    );
    expect(d.mintToken).toHaveBeenCalledTimes(1);
    expect(d.sendLicenseEmail).toHaveBeenCalledTimes(1);
    const sendArg = (d.sendLicenseEmail as jest.Mock).mock.calls[0][0];
    expect(sendArg.to).toBe('new@example.com');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd /tmp/aaf-licensing && npx nx test minting-service --testPathPattern=handlers`
Expected: 5 new tests FAIL with "handleSubscriptionUpdated: not yet implemented"

- [ ] **Step 3: Implement `handleSubscriptionUpdated`**

In `apps/minting-service/src/lib/handlers.ts`, replace the stub:

```ts
export async function handleSubscriptionUpdated(
  sub: Stripe.Subscription,
  deps: HandlerDeps,
): Promise<void> {
  const lineItem = sub.items?.data?.[0];
  if (!lineItem) {
    throw new Error(`handleSubscriptionUpdated: subscription ${sub.id} has no items`);
  }
  const priceMetadata = (lineItem.price?.metadata ?? {}) as Record<string, string>;
  const tier = extractTier(priceMetadata);
  const seats = computeSeats(tier, lineItem.quantity);
  const expiresAt = sub.current_period_end
    ? new Date(sub.current_period_end * 1000)
    : new Date(Date.now() + deps.defaultTtlDays * 24 * 60 * 60 * 1000);
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
  if (!customerId) {
    throw new Error(`handleSubscriptionUpdated: subscription ${sub.id} has no customer`);
  }

  const existing = await deps.getLicense(deps.db, sub.id);

  const claimsUnchanged =
    existing !== null &&
    existing.tier === tier &&
    existing.seats === seats &&
    existing.expiresAt.getTime() === expiresAt.getTime();

  // Email source: prefer existing license (captured at checkout), else pull
  // from Stripe customer.
  let email = existing?.customerEmail;
  if (!email) {
    const customer = await deps.stripe.customers.retrieve(customerId);
    if ('deleted' in customer && customer.deleted) {
      throw new Error(`handleSubscriptionUpdated: customer ${customerId} is deleted`);
    }
    email = (customer as Stripe.Customer).email ?? undefined;
    if (!email) {
      throw new Error(`handleSubscriptionUpdated: no email for customer ${customerId}`);
    }
  }

  if (claimsUnchanged && existing) {
    await deps.upsertLicense(deps.db, {
      stripeCustomerId: existing.stripeCustomerId,
      stripeSubscriptionId: existing.stripeSubscriptionId,
      customerEmail: existing.customerEmail,
      tier: existing.tier,
      seats: existing.seats,
      expiresAt: existing.expiresAt,
      lastToken: existing.lastToken,
    });
    return;
  }

  const token = await deps.mintToken(
    { stripeCustomerId: customerId, tier, seats, expiresAt },
    deps.privateKeyHex,
  );

  await deps.upsertLicense(deps.db, {
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
    customerEmail: email,
    tier,
    seats,
    expiresAt,
    lastToken: token,
  });

  await deps.sendLicenseEmail({
    resendApiKey: deps.resendApiKey,
    from: deps.emailFrom,
    to: email,
    vars: { tier, seats, token, expiresAt },
  });
}
```

- [ ] **Step 4: Update `HandlerDeps` interface to include `customers.retrieve`**

No change needed — `HandlerDeps.stripe` is typed as `Stripe`, which already includes `customers.retrieve`.

- [ ] **Step 5: Run tests — all should pass**

Run: `cd /tmp/aaf-licensing && npx nx test minting-service --testPathPattern=handlers`
Expected: PASS (10 tests now).

- [ ] **Step 6: Commit**

```bash
cd /tmp/aaf-licensing
git add apps/minting-service/src/lib/handlers.ts apps/minting-service/src/lib/handlers.spec.ts
git commit -m "feat(minting-service): implement handleSubscriptionUpdated with material-change check"
```

---

### Task 20: Verify `handleSubscriptionDeleted` behavior

**Files:**
- Modify: `apps/minting-service/src/lib/handlers.spec.ts`

**Context:** The handler itself was implemented in Task 17; add explicit tests to lock in the contract (revoke only, no email, no token mint).

- [ ] **Step 1: Add tests**

Append to `apps/minting-service/src/lib/handlers.spec.ts`:

```ts
describe('handleSubscriptionDeleted', () => {
  it('calls revokeLicense and does not email or mint', async () => {
    const d = makeDeps({
      revokeLicense: jest.fn().mockResolvedValue({ id: 'lic_d' }),
    });
    await handleEvent(
      { id: 'evt_del', type: 'customer.subscription.deleted', data: { object: { id: 'sub_d' } } } as Stripe.Event,
      d,
    );
    expect(d.revokeLicense).toHaveBeenCalledWith(d.db, 'sub_d');
    expect(d.mintToken).not.toHaveBeenCalled();
    expect(d.sendLicenseEmail).not.toHaveBeenCalled();
  });

  it('is idempotent — no throw if license is already absent', async () => {
    const d = makeDeps({
      revokeLicense: jest.fn().mockResolvedValue(null),
    });
    await expect(
      handleEvent(
        { id: 'evt_del2', type: 'customer.subscription.deleted', data: { object: { id: 'sub_nope' } } } as Stripe.Event,
        d,
      ),
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests**

Run: `cd /tmp/aaf-licensing && npx nx test minting-service --testPathPattern=handlers`
Expected: PASS (12 tests total).

- [ ] **Step 3: Commit**

```bash
cd /tmp/aaf-licensing
git add apps/minting-service/src/lib/handlers.spec.ts
git commit -m "test(minting-service): lock in handleSubscriptionDeleted contract"
```

---

## Phase F: API routes

### Task 21: Implement `api/health.ts`

**Files:**
- Create: `apps/minting-service/api/health.ts`

- [ ] **Step 1: Implement**

Create `apps/minting-service/api/health.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse): void {
  res.status(200).json({ ok: true });
}
```

- [ ] **Step 2: Install Vercel types**

Run:
```bash
cd /tmp/aaf-licensing
pnpm add -D @vercel/node
```

- [ ] **Step 3: Verify typecheck**

Run: `cd /tmp/aaf-licensing && npx tsc --noEmit -p apps/minting-service/tsconfig.app.json`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
cd /tmp/aaf-licensing
git add apps/minting-service/api/health.ts package.json pnpm-lock.yaml
git commit -m "feat(minting-service): add /api/health probe"
```

---

### Task 22: Implement `api/stripe-webhook.ts`

**Files:**
- Create: `apps/minting-service/api/stripe-webhook.ts`

**Context:** This file is the composition root. It loads env, reads the raw request body (Stripe signature verification requires the unparsed bytes), verifies the signature, builds a `HandlerDeps` object binding all the pure functions + DB client + Stripe SDK, and calls `handleEvent`. No unit test — this is a thin adapter and is exercised by the manual smoke test in Task 26.

- [ ] **Step 1: Implement**

Create `apps/minting-service/api/stripe-webhook.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { IncomingMessage } from 'node:http';
import {
  createDb,
  markEventProcessed,
  deleteProcessedEvent,
  upsertLicense,
  getLicense,
  revokeLicense,
} from '@cacheplane/db';
import { loadEnv } from '../src/lib/env.js';
import { getStripe } from '../src/lib/stripe.js';
import { mintToken } from '../src/lib/sign.js';
import { sendLicenseEmail } from '../src/lib/email.js';
import { handleEvent, type HandlerDeps } from '../src/lib/handlers.js';

export const config = { api: { bodyParser: false } };

async function readRawBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  const env = loadEnv();
  const stripe = getStripe(env.STRIPE_SECRET_KEY);

  const rawBody = await readRawBody(req);
  const sig = req.headers['stripe-signature'];
  if (typeof sig !== 'string') {
    res.status(400).send('missing signature');
    return;
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('stripe signature verification failed', err);
    res.status(400).send('invalid signature');
    return;
  }

  const db = createDb(env.DATABASE_URL);
  const deps: HandlerDeps = {
    db,
    stripe,
    markEventProcessed,
    deleteProcessedEvent,
    upsertLicense,
    getLicense,
    revokeLicense,
    mintToken,
    sendLicenseEmail,
    privateKeyHex: env.LICENSE_SIGNING_PRIVATE_KEY_HEX,
    resendApiKey: env.RESEND_API_KEY,
    emailFrom: env.EMAIL_FROM,
    defaultTtlDays: env.LICENSE_DEFAULT_TTL_DAYS,
  };

  try {
    await handleEvent(event, deps);
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('webhook handler error', { eventId: event.id, type: event.type, err });
    res.status(500).send('internal error');
  } finally {
    await db.close();
  }
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd /tmp/aaf-licensing && npx tsc --noEmit -p apps/minting-service/tsconfig.app.json`
Expected: PASS

- [ ] **Step 3: Verify lint**

Run: `cd /tmp/aaf-licensing && npx nx lint minting-service`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
cd /tmp/aaf-licensing
git add apps/minting-service/api/stripe-webhook.ts
git commit -m "feat(minting-service): add /api/stripe-webhook endpoint"
```

---

## Phase G: Deployment configuration

### Task 23: Create `vercel.json`

**Files:**
- Create: `apps/minting-service/vercel.json`

- [ ] **Step 1: Implement**

Create `apps/minting-service/vercel.json`:

```json
{
  "buildCommand": "cd ../.. && npx nx build minting-service",
  "outputDirectory": "../../dist/apps/minting-service",
  "installCommand": "cd ../.. && pnpm install --frozen-lockfile",
  "framework": null,
  "functions": {
    "api/*.ts": {
      "runtime": "nodejs20.x",
      "maxDuration": 10
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /tmp/aaf-licensing
git add apps/minting-service/vercel.json
git commit -m "feat(minting-service): add Vercel deployment config"
```

---

## Phase H: Manual re-mint CLI

### Task 24: Implement `scripts/remint.ts`

**Files:**
- Create: `apps/minting-service/scripts/remint.ts`
- Create: `apps/minting-service/scripts/remint.spec.ts`
- Modify: `apps/minting-service/project.json` (add `remint` target)

**Context:** A standalone script the operator runs against prod DB to re-send a license email. Reuses `renderLicenseEmail`/`sendLicenseEmail` from Section D. The script's flag parser + core logic are unit-tested; the actual `main()` entry that reads `process.argv` is thin.

- [ ] **Step 1: Write the failing test**

Create `apps/minting-service/scripts/remint.spec.ts`:

```ts
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
    getLicense: jest.fn().mockResolvedValue(makeLicense()),
    updateLicenseToken: jest.fn().mockImplementation(async (_db, _id, token) =>
      makeLicense({ lastToken: token, issuedAt: new Date() }),
    ),
    mintToken: jest.fn().mockResolvedValue('NEW.TOKEN'),
    sendLicenseEmail: jest.fn().mockResolvedValue({ resendId: 're_1' }),
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
    const sendArg = (deps.sendLicenseEmail as jest.Mock).mock.calls[0][0];
    expect(sendArg.to).toBe('a@example.com');
    expect(sendArg.vars.token).toBe('TOKEN.SIG');
    expect(result.sent).toBe(true);
  });

  it('overrides destination with --to', async () => {
    const deps = makeDeps();
    await runRemint({ sub: 'sub_1', dryRun: false, newToken: false, to: 'new@b.c' }, deps);
    const sendArg = (deps.sendLicenseEmail as jest.Mock).mock.calls[0][0];
    expect(sendArg.to).toBe('new@b.c');
  });

  it('mints and persists a new token with --new-token', async () => {
    const deps = makeDeps();
    await runRemint({ sub: 'sub_1', dryRun: false, newToken: true }, deps);
    expect(deps.mintToken).toHaveBeenCalledTimes(1);
    expect(deps.updateLicenseToken).toHaveBeenCalledTimes(1);
    const sendArg = (deps.sendLicenseEmail as jest.Mock).mock.calls[0][0];
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
      getLicense: jest.fn().mockResolvedValue(makeLicense({ revokedAt: new Date() })),
    });
    await expect(
      runRemint({ sub: 'sub_1', dryRun: false, newToken: false }, deps),
    ).rejects.toThrow(/revoked/);
  });

  it('throws when license does not exist', async () => {
    const deps = makeDeps({ getLicense: jest.fn().mockResolvedValue(null) });
    await expect(
      runRemint({ sub: 'sub_nope', dryRun: false, newToken: false }, deps),
    ).rejects.toThrow(/sub_nope/);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd /tmp/aaf-licensing && npx nx test minting-service --testPathPattern=remint`
Expected: FAIL with "Cannot find module './remint.js'"

- [ ] **Step 3: Implement**

Create `apps/minting-service/scripts/remint.ts`:

```ts
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
```

- [ ] **Step 4: Run tests — should pass**

Run: `cd /tmp/aaf-licensing && npx nx test minting-service --testPathPattern=remint`
Expected: PASS (11 tests).

- [ ] **Step 5: Add Nx target**

Edit `apps/minting-service/project.json`. Under `targets`, add:

```json
"remint": {
  "executor": "nx:run-commands",
  "options": {
    "command": "tsx scripts/remint.ts",
    "cwd": "apps/minting-service"
  }
}
```

- [ ] **Step 6: Commit**

```bash
cd /tmp/aaf-licensing
git add apps/minting-service/scripts/remint.ts apps/minting-service/scripts/remint.spec.ts apps/minting-service/project.json
git commit -m "feat(minting-service): add manual re-mint CLI"
```

---

## Phase I: Final verification and documentation

### Task 25: Operator README

**Files:**
- Create: `apps/minting-service/README.md`

- [ ] **Step 1: Write README**

Create `apps/minting-service/README.md`:

````markdown
# @cacheplane/minting-service

License minting service for Cacheplane. Receives Stripe webhooks, signs
Ed25519 license tokens via `@cacheplane/licensing`, persists them to
Postgres via `@cacheplane/db`, and emails them to customers via Resend.

**Design spec:** `docs/superpowers/specs/2026-04-20-minting-service-design.md`

## What this service does

- Handles Stripe events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.
- Mints a signed license token per active subscription.
- Emails the token to the customer.
- Stores license state keyed on `stripe_subscription_id`.

## What this service does NOT do

- No customer portal / self-service resend (run the CLI — see below).
- No pricing/checkout UI (handled on the website — Plan 3).
- No automated key rotation (requires library republish).

## Local development

1. Install Docker (for local Postgres) and the Stripe CLI.
2. From the repo root:
   ```bash
   docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=dev postgres:16
   cp apps/minting-service/.env.example apps/minting-service/.env
   # Edit .env with local values; for LICENSE_SIGNING_PRIVATE_KEY_HEX
   # generate a keypair (see "Generating a signing key" below).
   DATABASE_URL=postgres://postgres:dev@localhost:5432/postgres npx nx run db:db:migrate
   cd apps/minting-service && vercel dev
   ```
3. In another terminal:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe-webhook
   # Copy the printed whsec_... into apps/minting-service/.env as STRIPE_WEBHOOK_SECRET
   ```
4. Trigger events:
   ```bash
   stripe trigger checkout.session.completed
   ```

## Generating a signing key

```bash
node -e "import('@noble/ed25519').then(async (e) => {
  const sk = e.utils.randomPrivateKey();
  const pk = await e.getPublicKeyAsync(sk);
  console.log('priv (LICENSE_SIGNING_PRIVATE_KEY_HEX):', Buffer.from(sk).toString('hex'));
  console.log('pub  (LICENSE_PUBLIC_KEY in @cacheplane/licensing):', Buffer.from(pk).toString('hex'));
});"
```

Store the private key in the Vercel env as `LICENSE_SIGNING_PRIVATE_KEY_HEX`
marked "Sensitive". Back up to a password manager. The **public** key must be
baked into `libs/licensing/src/lib/license-public-key.generated.ts` and the
lib republished.

## Environment variables

All listed in `.env.example`. Validated at process start by `src/lib/env.ts`.
Missing/malformed vars throw with a descriptive message.

## Deployment

1. Ensure schema is up to date:
   ```bash
   DATABASE_URL=<prod-url> npx nx run db:db:migrate
   ```
2. Push. Vercel deploys from `main` automatically for production and per PR
   for previews.
3. Smoke test preview:
   ```bash
   curl https://<preview>.vercel.app/api/health   # {"ok":true}
   stripe trigger checkout.session.completed      # (against preview webhook endpoint)
   ```

## Operator runbook

### Re-mint a license

```bash
nx run minting-service:remint --sub=sub_1234 [--dry-run] [--to=new@email.com] [--new-token]
```

- `--sub=<stripe_subscription_id>` (required): which license to resend.
- `--dry-run`: print what would be sent; don't call Resend.
- `--to=<email>`: override destination (use after an email bounce).
- `--new-token`: re-sign a fresh token (updates `last_token` + `issued_at`).
  Default is to re-send the existing `last_token`.

Revoked licenses are refused.

### Look up a customer's license

```bash
psql $DATABASE_URL -c "SELECT * FROM licenses WHERE customer_email = 'x@y.z'"
```

### Manually revoke

```sql
UPDATE licenses SET revoked_at = now() WHERE stripe_subscription_id = 'sub_xxx';
```

Prefer canceling the Stripe subscription — this bypasses the normal webhook
flow and won't un-revoke on a new subscription.

### Un-revoke after accidental revoke

```sql
UPDATE licenses SET revoked_at = NULL WHERE stripe_subscription_id = 'sub_xxx';
```

Then `nx run minting-service:remint --sub=sub_xxx --new-token` to issue a
fresh token.

### Retry a failed webhook

1. In the Stripe dashboard → Developers → Webhooks, find the failed event `evt_xxx`.
2. Check if we recorded it:
   ```sql
   SELECT * FROM processed_events WHERE stripe_event_id = 'evt_xxx';
   ```
3. If present: `DELETE FROM processed_events WHERE stripe_event_id = 'evt_xxx';`
4. Click "Resend" on the event in Stripe.

### Rotate the signing key (manual, v1)

Current design requires a library republish (no multi-key verification).
Steps:

1. Generate new keypair (see "Generating a signing key").
2. Update `libs/licensing/src/lib/license-public-key.generated.ts` with the new public key.
3. Republish `@cacheplane/licensing` (minor version bump).
4. Update `LICENSE_SIGNING_PRIVATE_KEY_HEX` in Vercel env.
5. Deploy minting service.
6. Batch-remint all active licenses:
   ```bash
   # Example: loop over all non-revoked subs and re-mint with fresh tokens
   psql $DATABASE_URL -t -c "SELECT stripe_subscription_id FROM licenses WHERE revoked_at IS NULL" | \
     xargs -I{} nx run minting-service:remint --sub={} --new-token
   ```

All existing tokens become unverifiable once customers upgrade the library.

## Why this repo is public

The private signing key lives only in Vercel env. Everything else — schema,
webhook logic, re-mint flow — is plumbing. Possession of the key is the only
thing that matters. Documenting the process openly is a transparency plus.
````

- [ ] **Step 2: Commit**

```bash
cd /tmp/aaf-licensing
git add apps/minting-service/README.md
git commit -m "docs(minting-service): add operator runbook"
```

---

### Task 26: Final full-monorepo sanity sweep

**Files:** (none modified — verification only)

- [ ] **Step 1: Build everything**

Run: `cd /tmp/aaf-licensing && npx nx run-many -t build`
Expected: PASS for all projects including `licensing`, `db`, `minting-service`.

- [ ] **Step 2: Test everything**

Run: `cd /tmp/aaf-licensing && npx nx run-many -t test`
Expected: PASS for all projects. Integration tests for `db` require Docker — if running in CI without Docker, tag those specs and use a separate target.

- [ ] **Step 3: Lint everything**

Run: `cd /tmp/aaf-licensing && npx nx run-many -t lint`
Expected: PASS.

- [ ] **Step 4: Typecheck minting-service explicitly**

Run: `cd /tmp/aaf-licensing && npx tsc --noEmit -p apps/minting-service/tsconfig.app.json`
Expected: PASS.

- [ ] **Step 5: Manual preview smoke test** (requires a live Vercel preview deploy)

1. Deploy the branch as a Vercel preview.
2. Configure test Stripe keys + preview Postgres + test Resend key in Vercel preview env.
3. Run `DATABASE_URL=<preview-url> npx nx run db:db:migrate` against the preview DB.
4. `stripe trigger checkout.session.completed` (against the preview webhook URL).
5. Verify: `psql $PREVIEW_DATABASE_URL -c "SELECT * FROM licenses ORDER BY created_at DESC LIMIT 1;"` returns a row.
6. Verify email arrives at a Resend-verified test address.
7. Paste the token into a sandbox app with `CACHEPLANE_LICENSE=<token>`; verify `runLicenseCheck` reports active.
8. `stripe trigger customer.subscription.deleted`; verify `revoked_at` is set.
9. `nx run minting-service:remint --sub=<that-sub> --dry-run`; verify it refuses with "license is revoked".

- [ ] **Step 6: Commit any remaining hygiene fixes** (only if something surfaced during sweep)

```bash
cd /tmp/aaf-licensing
git status
# If clean, skip commit.
```

---

## Appendix: Open questions deferred to execution

- **Testcontainers in CI.** Local tests require Docker. If CI does not expose a Docker daemon, tag the integration specs with a pattern (e.g. filename `*.integration.spec.ts`) and gate them behind an env var. Decide when wiring CI.
- **Vercel project creation.** A person with Vercel dashboard access must: (a) create the project pointing at `apps/minting-service`, (b) configure env vars for prod and preview, (c) register the Stripe webhook endpoint URLs (test + live) in Stripe dashboard and paste the signing secrets back into Vercel. This is a one-time operator task, not automatable from the plan.
- **Resend domain verification.** Before any live email sends, verify the sender domain in Resend. Out of scope for code but blocks prod rollout.
