import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import type {
  SqlExecutor,
  SqlQueryResult,
  SqlTransaction,
} from '../libs/growth/src/index.ts';
import * as migrationRunner from './apply-migrations.mts';

const { applyMigrations, discoverMigrations } = migrationRunner;

interface AppliedMigration {
  checksum: string;
}

class FakeExecutor implements SqlExecutor, SqlTransaction {
  readonly migrations = new Map<string, AppliedMigration>();
  readonly migrationSql: string[] = [];
  readonly executedSql: string[] = [];
  transactionCount = 0;

  async execute<Row extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    parameters: readonly unknown[] = []
  ): Promise<SqlQueryResult<Row>> {
    this.executedSql.push(sql);
    if (sql.includes('select name, checksum')) {
      const name = String(parameters[0]);
      const applied = this.migrations.get(name);
      return {
        rows: (applied
          ? [{ name, checksum: applied.checksum }]
          : []) as unknown as Row[],
      };
    }

    if (sql.includes('insert into threadplane_schema_migrations')) {
      const name = String(parameters[0]);
      this.migrations.set(name, { checksum: String(parameters[1]) });
      return { rows: [] };
    }

    if (
      !sql.includes(
        'create table if not exists threadplane_schema_migrations'
      ) &&
      !sql.includes('pg_advisory_xact_lock') &&
      !sql.includes('set local search_path to public')
    ) {
      this.migrationSql.push(sql);
    }

    return { rows: [] };
  }

  async transaction<T>(
    operation: (transaction: SqlTransaction) => Promise<T>
  ): Promise<T> {
    this.transactionCount += 1;
    return operation(this);
  }
}

describe('migration runner', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'threadplane-migrations-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('discovers only numbered SQL migrations in lexical order', async () => {
    await Promise.all([
      writeFile(join(directory, '0010_tenth.sql'), 'select 10;'),
      writeFile(join(directory, '0002_second.sql'), 'select 2;'),
      writeFile(join(directory, 'notes.sql'), 'select 0;'),
      writeFile(join(directory, '0003_ignored.txt'), 'select 3;'),
    ]);

    const migrations = await discoverMigrations(directory);

    expect(migrations.map(({ name }) => name)).toEqual([
      '0002_second.sql',
      '0010_tenth.sql',
    ]);
  });

  it('accepts only canonical lowercase migration filenames', async () => {
    await Promise.all([
      writeFile(join(directory, '0004_a.sql'), 'select 4;'),
      writeFile(join(directory, '12345_multi-part_slug9.sql'), 'select 5;'),
      writeFile(join(directory, '0004_name.SQL'), 'select 0;'),
      writeFile(join(directory, '0004foo_bar.sql'), 'select 0;'),
      writeFile(join(directory, '0004__bar.sql'), 'select 0;'),
      writeFile(join(directory, '0004_.sql'), 'select 0;'),
      writeFile(join(directory, '0004_bad--slug.sql'), 'select 0;'),
      writeFile(join(directory, '0004_trailing-.sql'), 'select 0;'),
    ]);

    const migrations = await discoverMigrations(directory);

    expect(migrations.map(({ name }) => name)).toEqual([
      '0004_a.sql',
      '12345_multi-part_slug9.sql',
    ]);
  });

  it('discovers repository migrations from an unrelated working directory', async () => {
    const originalWorkingDirectory = process.cwd();
    process.chdir(directory);

    try {
      const migrations = await discoverMigrations(
        migrationRunner.defaultMigrationsDirectory()
      );
      expect(migrations.map(({ name }) => name).slice(0, 3)).toEqual([
        '0001_rate_limit_events.sql',
        '0002_growth_control_plane.sql',
        '0003_growth_reporting_views.sql',
      ]);
    } finally {
      process.chdir(originalWorkingDirectory);
    }
  });

  it('applies every migration in its own transaction and records a checksum', async () => {
    await writeFile(join(directory, '0001_first.sql'), 'select 1;');
    await writeFile(join(directory, '0002_second.sql'), 'select 2;');
    const executor = new FakeExecutor();

    const result = await applyMigrations({ directory, executor });

    expect(result).toEqual({
      applied: ['0001_first.sql', '0002_second.sql'],
      skipped: [],
    });
    expect(executor.transactionCount).toBe(2);
    expect(executor.migrationSql).toEqual(['select 1;', 'select 2;']);
    expect(executor.migrations.get('0001_first.sql')?.checksum).toMatch(
      /^[a-f0-9]{64}$/
    );
  });

  it('pins every migration transaction to the canonical public schema', async () => {
    await writeFile(join(directory, '0001_first.sql'), 'select 1;');
    const executor = new FakeExecutor();

    await applyMigrations({ directory, executor });

    expect(executor.executedSql[0]).toMatch(
      /^\s*set local search_path to public\s*$/i
    );
  });

  it('is repeatable and applies no SQL when checksums match', async () => {
    await writeFile(join(directory, '0001_first.sql'), 'select 1;');
    const executor = new FakeExecutor();

    await applyMigrations({ directory, executor });
    const secondRun = await applyMigrations({ directory, executor });

    expect(secondRun).toEqual({ applied: [], skipped: ['0001_first.sql'] });
    expect(executor.transactionCount).toBe(2);
    expect(executor.migrationSql).toEqual(['select 1;']);
  });

  it('refuses to run when an applied migration has changed', async () => {
    const migrationPath = join(directory, '0001_first.sql');
    await writeFile(migrationPath, 'select 1;');
    const executor = new FakeExecutor();
    await applyMigrations({ directory, executor });
    await writeFile(migrationPath, 'select 2;');

    await expect(applyMigrations({ directory, executor })).rejects.toThrow(
      'Checksum mismatch for applied migration 0001_first.sql'
    );
    expect(executor.migrationSql).toEqual(['select 1;']);
  });
});

describe('production database factory', () => {
  it('does not read environment state during module import and fails closed without DATABASE_URL', async () => {
    const previous = process.env['DATABASE_URL'];
    delete process.env['DATABASE_URL'];

    try {
      const database = await import('../libs/growth/src/lib/database.ts');
      expect(() => database.createDatabaseExecutor()).toThrow(
        'DATABASE_URL is required'
      );
    } finally {
      if (previous === undefined) {
        delete process.env['DATABASE_URL'];
      } else {
        process.env['DATABASE_URL'] = previous;
      }
    }
  });
});

describe('growth control plane schema contract', () => {
  it('uses the default NO ACTION behavior for every foreign key', async () => {
    const sql = await readFile(
      resolve(process.cwd(), 'migrations/0002_growth_control_plane.sql'),
      'utf8'
    );

    expect(sql.match(/\bREFERENCES\b/gi)).toHaveLength(8);
    expect(sql).not.toMatch(/\bON\s+DELETE\b/i);
  });

  it('indexes contact linkage, expired leases, and campaign predecessors', async () => {
    const sql = await readFile(
      resolve(process.cwd(), 'migrations/0002_growth_control_plane.sql'),
      'utf8'
    );

    expect(sql).toMatch(
      /CREATE INDEX growth_projects_contact\s+ON growth_projects \(contact_id\)\s+WHERE contact_id IS NOT NULL;/u
    );
    expect(sql).toMatch(
      /CREATE INDEX growth_jobs_expired_lease\s+ON growth_jobs \(lease_until, id\)\s+WHERE status = 'leased';/u
    );
    expect(sql).toMatch(
      /CREATE INDEX growth_jobs_contact\s+ON growth_jobs \(contact_id, id\)\s+WHERE contact_id IS NOT NULL;/u
    );
    expect(sql).toMatch(
      /CREATE INDEX growth_jobs_campaign_predecessor\s+ON growth_jobs \(\s*contact_id,\s*\(payload->>'campaign_version'\),\s*\(payload->>'step'\)\s*\)\s+WHERE kind = 'send_step';/u
    );
  });
});

describe('growth reporting view contracts', () => {
  it('includes approval-only and claim-only dates in the funnel date domain', async () => {
    const sql = await readFile(
      resolve(process.cwd(), 'migrations/0003_growth_reporting_views.sql'),
      'utf8'
    );

    expect(sql).toMatch(
      /SELECT outreach_approved_at::date AS day FROM growth_contacts/
    );
    expect(sql).toMatch(
      /SELECT claim_consumed_at::date AS day FROM growth_projects/
    );
  });

  it('pre-aggregates every one-to-many contact relation before joining contacts', async () => {
    const sql = await readFile(
      resolve(process.cwd(), 'migrations/0003_growth_reporting_views.sql'),
      'utf8'
    );

    expect(sql).toMatch(
      /project_summary AS\s*\([\s\S]*?GROUP BY contact_id\s*\)/
    );
    expect(sql).toMatch(
      /activity_summary AS\s*\([\s\S]*?GROUP BY contact_id\s*\)/
    );
    expect(sql).toMatch(/job_summary AS\s*\([\s\S]*?GROUP BY contact_id\s*\)/);
    expect(sql).not.toMatch(/LEFT JOIN growth_(?:projects|activity|jobs) AS/);
  });

  it('keeps private lookup aliases outside every activity-based reporting aggregate', async () => {
    const sql = await readFile(
      resolve(process.cwd(), 'migrations/0003_growth_reporting_views.sql'),
      'utf8'
    );

    const contactOverview = sql.match(
      /CREATE VIEW growth_contact_overview_v1 AS([\s\S]*?)CREATE VIEW growth_funnel_daily_v1 AS/
    )?.[1];
    const funnel = sql.match(
      /CREATE VIEW growth_funnel_daily_v1 AS([\s\S]*?)CREATE VIEW growth_campaign_performance_v1 AS/
    )?.[1];
    const closedJobViews = sql.match(
      /CREATE VIEW growth_campaign_performance_v1 AS([\s\S]*)$/
    )?.[1];

    expect(contactOverview).toMatch(
      /FROM growth_activity\s+WHERE contact_id IS NOT NULL\s+AND kind <> 'contact\.lookup_alias_added'/
    );
    expect(
      funnel?.match(/kind <> 'contact\.lookup_alias_added'/g)
    ).toHaveLength(2);
    expect(closedJobViews).not.toMatch(/growth_activity/);
  });
});

describe('growth integration test isolation', () => {
  it('uses structurally separate unit and integration Vitest configs', async () => {
    const unitConfig = await readFile(
      resolve(process.cwd(), 'libs/growth/vite.config.mts'),
      'utf8'
    );
    const integrationConfig = await readFile(
      resolve(process.cwd(), 'libs/growth/vite.integration.config.mts'),
      'utf8'
    );

    expect(unitConfig).not.toContain('GROWTH_INTEGRATION');
    expect(unitConfig).not.toContain('TEST_DATABASE_URL');
    expect(unitConfig).not.toContain('.integration.spec.ts');
    expect(integrationConfig).toContain('GROWTH_INTEGRATION');
    expect(integrationConfig).toContain('TEST_DATABASE_URL');
    expect(integrationConfig).toContain('fileParallelism: false');
    expect(integrationConfig).toContain('**/*.integration.spec.ts');
  });

  it('makes the Nx integration target delegate environment control to the preflight launcher', async () => {
    const project = JSON.parse(
      await readFile(resolve(process.cwd(), 'libs/growth/project.json'), 'utf8')
    ) as {
      targets: Record<string, { options?: { command?: string } }>;
    };
    const command = project.targets['test-integration']?.options?.command;

    expect(command).toBe(
      'node --import tsx scripts/growth-database-preflight.mts integration'
    );
    expect(command).not.toContain('GROWTH_INTEGRATION=1');

    const launcher = await readFile(
      resolve(process.cwd(), 'scripts/growth-database-preflight.mts'),
      'utf8'
    );
    expect(launcher).toContain('libs/growth/vite.integration.config.mts');
  });

  it('requires both the explicit integration gate and test database variable in every conditional database suite', async () => {
    const conditionalSpecs = [
      resolve(
        process.cwd(),
        'libs/growth/test/concurrency.integration.spec.ts'
      ),
      resolve(process.cwd(), 'libs/growth/test/contacts.integration.spec.ts'),
      resolve(process.cwd(), 'libs/growth/test/forms.integration.spec.ts'),
      resolve(process.cwd(), 'libs/growth/test/jobs.integration.spec.ts'),
      resolve(process.cwd(), 'libs/growth/test/migrations.integration.spec.ts'),
      resolve(process.cwd(), 'libs/growth/test/replies.integration.spec.ts'),
      resolve(process.cwd(), 'libs/growth/test/scoring.integration.spec.ts'),
      resolve(process.cwd(), 'libs/growth/test/stops.integration.spec.ts'),
    ];

    for (const specPath of conditionalSpecs) {
      const source = await readFile(specPath, 'utf8');
      expect(source, specPath).toContain(
        "process.env['GROWTH_INTEGRATION'] === '1'"
      );
      expect(source, specPath).toContain("process.env['TEST_DATABASE_URL']");
    }
  });

  it('keeps the real-database reply test out of the ordinary unit file', async () => {
    const unitSource = await readFile(
      resolve(process.cwd(), 'libs/growth/src/lib/replies.spec.ts'),
      'utf8'
    );
    const integrationSource = await readFile(
      resolve(process.cwd(), 'libs/growth/test/replies.integration.spec.ts'),
      'utf8'
    );

    expect(unitSource).not.toContain('real-database rollback boundary');
    expect(unitSource).not.toContain('createDatabaseExecutor');
    expect(integrationSource).toContain('real-database rollback boundary');
  });

  it('defines the integration inventory against public with exact migration-ledger coverage', async () => {
    const source = await readFile(
      resolve(process.cwd(), 'libs/growth/test/migrations.integration.spec.ts'),
      'utf8'
    );

    expect(source).toContain("table_schema = 'public'");
    expect(source).toContain("table_name like 'growth\\\\_%' escape '\\\\'");
    expect(source).not.toContain("table_name like 'growth\\\\_%\\\\_v1'");
    expect(source).toContain('threadplane_schema_migrations');
    expect(source).toContain("'0001_rate_limit_events.sql'");
    expect(source).toContain("'0002_growth_control_plane.sql'");
    expect(source).toContain("'0003_growth_reporting_views.sql'");
  });
});

describe('growth cutover database gates', () => {
  it('documents exact first/second migration outcomes and boolean exact-set inventory', async () => {
    const runbook = await readFile(
      resolve(
        process.cwd(),
        'docs/superpowers/runbooks/2026-08-31-growth-lifecycle-cutover.md'
      ),
      'utf8'
    );

    expect(runbook).toContain('3 applied, 0 unchanged');
    expect(runbook).toContain('0 applied, 3 unchanged');
    expect(runbook).toContain('canonical_public_schema');
    expect(runbook).toContain('exact_growth_table_set');
    expect(runbook).toContain('exact_growth_view_set');
    expect(runbook).toContain('exact_migration_ledger_set');
    expect(runbook).toContain("table_name like 'growth\\_%' escape '\\'");
    expect(runbook).not.toContain("table_name like 'growth\\_%\\_v1'");
  });

  it('disables inherited xtrace before secret expansion and forbids traced transcripts', async () => {
    const runbook = await readFile(
      resolve(
        process.cwd(),
        'docs/superpowers/runbooks/2026-08-31-growth-lifecycle-cutover.md'
      ),
      'utf8'
    );
    const secretBlocks = [...runbook.matchAll(/```bash\n([\s\S]*?)```/g)]
      .map((match) => match[1] ?? '')
      .filter((block) => block.includes('PREVIEW_GROWTH_DATABASE_URL'));

    expect(secretBlocks.length).toBeGreaterThanOrEqual(2);
    for (const block of secretBlocks) {
      expect(block.indexOf('set +x')).toBeGreaterThanOrEqual(0);
      expect(block.indexOf('set +x')).toBeLessThan(
        block.indexOf('${PREVIEW_GROWTH_DATABASE_URL')
      );
    }
    expect(runbook).toMatch(/forbid[^\n]+xtrace/iu);
    expect(runbook).toMatch(/forbid[^\n]+transcript/iu);

    const syntheticSecret = 'synthetic-trace-canary';
    const traced = spawnSync(
      'sh',
      ['-c', 'set -x\n(\n  set +x\n  test -n "$SYNTHETIC_SECRET"\n)\n'],
      {
        encoding: 'utf8',
        env: { ...process.env, SYNTHETIC_SECRET: syntheticSecret },
      }
    );
    expect(traced.status).toBe(0);
    expect(`${traced.stdout}${traced.stderr}`).not.toContain(syntheticSecret);
  });

  it('uses opaque provider target IDs for target separation and records only closed results', async () => {
    const runbook = await readFile(
      resolve(
        process.cwd(),
        'docs/superpowers/runbooks/2026-08-31-growth-lifecycle-cutover.md'
      ),
      'utf8'
    );

    expect(runbook).toMatch(/opaque provider target IDs/iu);
    expect(runbook).toContain('growth-preview-target-01');
    expect(runbook).toContain('growth-production-target-01');
    expect(runbook).toContain('dawn-preview-target-01');
    expect(runbook).toMatch(/MATCH[^\n]+MISMATCH[^\n]+BLOCKED/u);
    expect(runbook).toMatch(/DISTINCT[^\n]+SAME[^\n]+BLOCKED/u);
    expect(runbook).toMatch(/do not compare[^\n]+URL/iu);
    expect(runbook).toMatch(/do not[^\n]+hash/iu);
  });
});

describe('growth database preflight', () => {
  async function preflightModule() {
    return import('./growth-database-preflight.mts');
  }

  it.each([
    [{}, 'TEST_DATABASE_URL is required'],
    [{ TEST_DATABASE_URL: '   ' }, 'TEST_DATABASE_URL is required'],
    [
      { TEST_DATABASE_URL: 'postgres://synthetic', DATABASE_URL: '' },
      'DATABASE_URL must be absent',
    ],
    [
      { TEST_DATABASE_URL: 'postgres://synthetic', DAWN_DATABASE_URL: '' },
      'DAWN_DATABASE_URL must be absent',
    ],
  ])(
    'rejects an unsafe integration environment without invoking a runner',
    async (environment, expectedMessage) => {
      const { runGrowthIntegrationTests } = await preflightModule();
      const runner = vi.fn(() => ({ status: 0 }));

      expect(() =>
        runGrowthIntegrationTests({
          environment,
          nodeVersion: '22.22.0',
          runner,
        })
      ).toThrow(expectedMessage);
      expect(runner).not.toHaveBeenCalled();
    }
  );

  it('rejects integration execution outside Node 22 without invoking a runner', async () => {
    const { runGrowthIntegrationTests } = await preflightModule();
    const runner = vi.fn(() => ({ status: 0 }));

    expect(() =>
      runGrowthIntegrationTests({
        environment: { TEST_DATABASE_URL: 'postgres://synthetic' },
        nodeVersion: '24.0.0',
        runner,
      })
    ).toThrow('Node 22 is required');
    expect(runner).not.toHaveBeenCalled();
  });

  it('sets the integration gate itself and reaches an injected runner without connecting', async () => {
    const { runGrowthIntegrationTests } = await preflightModule();
    const runner = vi.fn(() => ({ status: 0 }));

    const status = runGrowthIntegrationTests({
      environment: {
        TEST_DATABASE_URL: 'postgres://synthetic',
        GROWTH_INTEGRATION: 'untrusted-shell-value',
      },
      nodeVersion: '22.22.0',
      runner,
    });

    expect(status).toBe(0);
    expect(runner).toHaveBeenCalledOnce();
    expect(runner.mock.calls[0]?.[2]).toMatchObject({
      env: expect.objectContaining({ GROWTH_INTEGRATION: '1' }),
    });
  });

  it.each([
    [{}, 'DATABASE_URL is required'],
    [{ DATABASE_URL: '  ' }, 'DATABASE_URL is required'],
    [
      { DATABASE_URL: 'postgres://synthetic', TEST_DATABASE_URL: '' },
      'TEST_DATABASE_URL must be absent',
    ],
    [
      { DATABASE_URL: 'postgres://synthetic', DAWN_DATABASE_URL: '' },
      'DAWN_DATABASE_URL must be absent',
    ],
  ])(
    'rejects an unsafe migration environment',
    async (environment, expectedMessage) => {
      const { validateGrowthDatabaseEnvironment } = await preflightModule();

      expect(() =>
        validateGrowthDatabaseEnvironment({
          mode: 'migration',
          environment,
          nodeVersion: '22.22.0',
        })
      ).toThrow(expectedMessage);
    }
  );
});
