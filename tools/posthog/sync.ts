import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { DashboardLocal, InsightLocal, CohortLocal } from './schema.js';
import { z } from 'zod';

// Minimal remote shapes — we only read fields we use, so we keep these loose.
export interface RemoteDashboard { id: number; name: string; tags?: string[] }
export interface RemoteInsight { id: number; name: string; filters?: unknown }
export interface RemoteCohort { id: number; name: string }

// Transport interface. The real client adapts openapi-fetch to this shape.
export interface SyncClient {
  listDashboards(): Promise<RemoteDashboard[]>;
  listInsights(): Promise<RemoteInsight[]>;
  listCohorts(): Promise<RemoteCohort[]>;
  createDashboard(body: any): Promise<RemoteDashboard>;
  createInsight(body: any): Promise<RemoteInsight>;
  createCohort(body: any): Promise<RemoteCohort>;
  updateDashboard(id: number, body: any): Promise<RemoteDashboard>;
  updateInsight(id: number, body: any): Promise<RemoteInsight>;
  updateCohort(id: number, body: any): Promise<RemoteCohort>;
  deleteDashboard(id: number): Promise<void>;
  deleteInsight(id: number): Promise<void>;
  deleteCohort(id: number): Promise<void>;
}

export type Kind = 'dashboard' | 'insight' | 'cohort';

export interface PlanItem {
  kind: Kind;
  local?: any;
  remote?: any;
  remoteId?: number;
  path?: string;
}

export interface SyncPlan {
  create: PlanItem[];
  update: PlanItem[];
  orphan: PlanItem[];
}

async function loadLocalDir<T>(
  root: string,
  subdir: string,
  schema: z.ZodType<T>,
): Promise<Array<{ data: T; path: string }>> {
  const dir = join(root, subdir);
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
  const out: Array<{ data: T; path: string }> = [];
  for (const f of files) {
    const path = join(subdir, f);
    const json = JSON.parse(await readFile(join(root, path), 'utf8'));
    const result = schema.safeParse(json);
    if (!result.success) {
      throw new Error(`${path}: ${JSON.stringify(result.error.issues)}`);
    }
    out.push({ data: result.data, path });
  }
  return out;
}

function matchRemoteById<R extends { id: number; name: string }>(
  local: { posthog_id: number | null; name: string },
  remotes: R[],
): { remote: R | null; ambiguous: R[] } {
  if (local.posthog_id !== null) {
    const remote = remotes.find((r) => r.id === local.posthog_id) ?? null;
    return { remote, ambiguous: [] };
  }
  const named = remotes.filter((r) => r.name === local.name);
  if (named.length === 1) return { remote: named[0], ambiguous: [] };
  if (named.length > 1) return { remote: null, ambiguous: named };
  return { remote: null, ambiguous: [] };
}

export async function computePlan({
  root,
  client,
}: {
  root: string;
  client: SyncClient;
}): Promise<SyncPlan> {
  const localDashboards = await loadLocalDir(root, 'dashboards', DashboardLocal);
  const localInsights = await loadLocalDir(root, 'insights', InsightLocal);
  const localCohorts = await loadLocalDir(root, 'cohorts', CohortLocal);
  const remoteDashboards = await client.listDashboards();
  const remoteInsights = await client.listInsights();
  const remoteCohorts = await client.listCohorts();

  const plan: SyncPlan = { create: [], update: [], orphan: [] };
  const matchedRemoteIds = { dashboard: new Set<number>(), insight: new Set<number>(), cohort: new Set<number>() };

  const apply = <L extends { slug: string; posthog_id: number | null; name: string }, R extends { id: number; name: string }>(
    kind: Kind,
    locals: Array<{ data: L; path: string }>,
    remotes: R[],
    matched: Set<number>,
  ) => {
    for (const { data, path } of locals) {
      const { remote, ambiguous } = matchRemoteById(data, remotes);
      if (remote) {
        plan.update.push({ kind, local: data, remote, remoteId: remote.id, path });
        matched.add(remote.id);
      } else if (ambiguous.length > 0) {
        plan.create.push({ kind, local: data, path });
        for (const r of ambiguous) {
          plan.orphan.push({ kind, remote: r });
          matched.add(r.id);
        }
      } else {
        plan.create.push({ kind, local: data, path });
      }
    }
    for (const r of remotes) {
      if (!matched.has(r.id)) {
        plan.orphan.push({ kind, remote: r });
      }
    }
  };

  apply('dashboard', localDashboards, remoteDashboards, matchedRemoteIds.dashboard);
  apply('insight', localInsights, remoteInsights, matchedRemoteIds.insight);
  apply('cohort', localCohorts, remoteCohorts, matchedRemoteIds.cohort);

  return plan;
}

import { writeFile, rename } from 'node:fs/promises';

export interface ApplyResult {
  applied: number;
  failed: number;
  errors: Array<{ kind: Kind; slug: string; error: string }>;
}

export interface ApplyOptions {
  root: string;
  client: SyncClient;
  plan: SyncPlan;
  dryRun?: boolean;
  deleteOrphans?: boolean;
}

async function atomicWriteJson(path: string, data: unknown): Promise<void> {
  const tmpPath = `${path}.tmp`;
  await writeFile(tmpPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  await rename(tmpPath, path);
}

function resolveTiles(
  dashboard: any,
  insightSlugToId: Map<string, number>,
): Array<{ insight: number }> {
  return (dashboard.tiles ?? []).map((t: { insight: string }) => {
    const id = insightSlugToId.get(t.insight);
    if (id === undefined) {
      throw new Error(
        `dashboards/${dashboard.slug}.json references unknown insight slug "${t.insight}"`,
      );
    }
    return { insight: id };
  });
}

// PostHog rejects/ignores a `tiles` field on dashboard create/update.
// We keep tiles in the local JSON as the source of truth, but strip them
// from the body sent to PostHog. The wiring pass populates each insight's
// `dashboards` field instead.
function stripTiles(local: any): any {
  const { tiles: _tiles, ...rest } = local;
  return rest;
}

// Map our local InsightLocal shape (flat fields per zod schema) to PostHog's
// nested filters.{events,breakdown,date_from,...} body shape. PostHog ignores
// our top-level fields and stores blank filters if we don't do this mapping.
//
// Exported for unit testing.
export function toPostHogInsight(local: any): any {
  const base = {
    name: local.name,
    description: local.description ?? '',
  };
  const kind: string = local.kind;
  if (kind === 'funnel') {
    return {
      ...base,
      filters: {
        insight: 'FUNNELS',
        events: (local.steps ?? []).map((s: any, idx: number) => ({
          id: s.event,
          name: s.name ?? s.event,
          order: idx,
          type: 'events',
        })),
        funnel_window_interval: local.window_minutes ?? 60,
        funnel_window_interval_unit: 'minute',
        date_from: local.date_from ?? '-30d',
      },
    };
  }
  if (kind === 'trends') {
    return {
      ...base,
      filters: {
        insight: 'TRENDS',
        events: (local.events ?? []).map((e: any, idx: number) => ({
          id: e.event,
          name: e.event,
          order: idx,
          type: 'events',
          math: e.math ?? 'total',
          properties: e.properties ?? [],
        })),
        breakdown: local.breakdown,
        breakdown_limit: local.breakdown_limit,
        breakdown_type: local.breakdown ? 'event' : undefined,
        date_from: local.date_from ?? '-30d',
        interval: local.interval ?? 'day',
      },
    };
  }
  // retention or other — passthrough with the kind set so PostHog accepts it.
  return { ...base, filters: { insight: 'RETENTION', date_from: local.date_from ?? '-30d' } };
}

// Map DashboardLocal to PostHog's body shape. tiles is read-only on create/update;
// stripped here. The wiring pass associates insights with dashboards instead.
export function toPostHogDashboard(local: any): any {
  return {
    name: local.name,
    description: local.description ?? '',
    tags: local.tags ?? [],
  };
}

export async function applyPlan(options: ApplyOptions): Promise<ApplyResult> {
  const { root, client, plan, dryRun = false, deleteOrphans = false } = options;
  const result: ApplyResult = { applied: 0, failed: 0, errors: [] };
  const insightSlugToId = new Map<string, number>();

  // Pre-populate insight slug→id map from existing posthog_ids (for dashboards referencing already-synced insights).
  for (const item of plan.update.filter((p) => p.kind === 'insight')) {
    insightSlugToId.set(item.local.slug, item.remoteId!);
  }

  // Apply order: cohorts → insights → dashboards. Creates within a tier before updates.
  const tiers: Array<{ kind: Kind; create: PlanItem[]; update: PlanItem[] }> = [
    { kind: 'cohort', create: plan.create.filter((p) => p.kind === 'cohort'), update: plan.update.filter((p) => p.kind === 'cohort') },
    { kind: 'insight', create: plan.create.filter((p) => p.kind === 'insight'), update: plan.update.filter((p) => p.kind === 'insight') },
    { kind: 'dashboard', create: plan.create.filter((p) => p.kind === 'dashboard'), update: plan.update.filter((p) => p.kind === 'dashboard') },
  ];

  const dashboardSlugToId = new Map<string, number>();
  // Pre-populate dashboard slug→id map from existing posthog_ids (for wiring pass below).
  for (const item of plan.update.filter((p) => p.kind === 'dashboard')) {
    dashboardSlugToId.set(item.local.slug, item.remoteId!);
  }

  for (const tier of tiers) {
    for (const item of tier.create) {
      if (dryRun) continue;
      // Resolve tile slugs outside the try — unknown insight slug is a data error
      // that must surface, not a per-item network failure. We don't actually send
      // the resolved tiles to PostHog (dashboards' tiles field is read-only on
      // create/update; the wiring pass below sets each insight's `dashboards` field
      // instead), but resolving here gives early validation.
      if (item.kind === 'dashboard') resolveTiles(item.local, insightSlugToId);
      try {
        let created: any;
        if (item.kind === 'cohort') created = await client.createCohort(item.local);
        else if (item.kind === 'insight') created = await client.createInsight(toPostHogInsight(item.local));
        else created = await client.createDashboard(toPostHogDashboard(item.local));
        if (item.kind === 'insight') insightSlugToId.set(item.local.slug, created.id);
        if (item.kind === 'dashboard') dashboardSlugToId.set(item.local.slug, created.id);
        // Writeback posthog_id into local JSON.
        if (item.path) {
          const fullPath = join(root, item.path);
          await atomicWriteJson(fullPath, { ...item.local, posthog_id: created.id });
        }
        result.applied += 1;
      } catch (err) {
        result.failed += 1;
        result.errors.push({
          kind: item.kind,
          slug: item.local.slug,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    for (const item of tier.update) {
      if (dryRun) continue;
      if (item.kind === 'dashboard') resolveTiles(item.local, insightSlugToId);
      try {
        if (item.kind === 'cohort') await client.updateCohort(item.remoteId!, item.local);
        else if (item.kind === 'insight') await client.updateInsight(item.remoteId!, toPostHogInsight(item.local));
        else await client.updateDashboard(item.remoteId!, toPostHogDashboard(item.local));
        result.applied += 1;
      } catch (err) {
        result.failed += 1;
        result.errors.push({
          kind: item.kind,
          slug: item.local.slug,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  // Wiring pass: PostHog associates insights with dashboards via the insight's
  // `dashboards: number[]` field. PATCH each insight that any local dashboard
  // references with its full desired dashboards list (idempotent).
  if (!dryRun) {
    type LocalDashboard = { slug: string; posthog_id: number | null; tiles?: Array<{ insight: string }> };
    const localDashboards = (await loadLocalDir(root, 'dashboards', DashboardLocal)) as Array<{ data: LocalDashboard; path: string }>;
    const insightDesiredDashboards = new Map<string, number[]>();  // insight slug → dashboard ids
    for (const { data: d } of localDashboards) {
      const dashId = dashboardSlugToId.get(d.slug) ?? d.posthog_id;
      if (typeof dashId !== 'number') continue;
      for (const tile of d.tiles ?? []) {
        const existing = insightDesiredDashboards.get(tile.insight) ?? [];
        if (!existing.includes(dashId)) existing.push(dashId);
        insightDesiredDashboards.set(tile.insight, existing);
      }
    }
    for (const [insightSlug, dashboardIds] of insightDesiredDashboards) {
      const insightId = insightSlugToId.get(insightSlug);
      if (typeof insightId !== 'number') continue;
      try {
        await client.updateInsight(insightId, { dashboards: dashboardIds });
      } catch (err) {
        result.errors.push({
          kind: 'insight',
          slug: `${insightSlug} (wiring)`,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  if (deleteOrphans && !dryRun) {
    for (const item of plan.orphan) {
      try {
        if (item.kind === 'cohort') await client.deleteCohort(item.remote.id);
        else if (item.kind === 'insight') await client.deleteInsight(item.remote.id);
        else await client.deleteDashboard(item.remote.id);
      } catch (err) {
        result.errors.push({
          kind: item.kind,
          slug: `(orphan id=${item.remote.id})`,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return result;
}

import { fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { ph } from './client.js';

function makeRealClient(): SyncClient {
  const c = ph();
  const ok = <T>(r: { data?: T; error?: unknown }, op: string): T => {
    if (r.error || r.data === undefined) {
      throw new Error(`PostHog ${op} failed: ${JSON.stringify(r.error)}`);
    }
    return r.data;
  };
  return {
    listDashboards: async () => {
      const r = await c.GET('/dashboards/' as any, { params: { query: { limit: 200 } } } as any);
      return ((ok(r as any, 'list dashboards') as any).results ?? []) as RemoteDashboard[];
    },
    listInsights: async () => {
      const r = await c.GET('/insights/' as any, { params: { query: { limit: 200 } } } as any);
      return ((ok(r as any, 'list insights') as any).results ?? []) as RemoteInsight[];
    },
    listCohorts: async () => {
      const r = await c.GET('/cohorts/' as any, { params: { query: { limit: 200 } } } as any);
      return ((ok(r as any, 'list cohorts') as any).results ?? []) as RemoteCohort[];
    },
    createDashboard: async (body) => ok(await c.POST('/dashboards/' as any, { body } as any), 'create dashboard') as RemoteDashboard,
    createInsight: async (body) => ok(await c.POST('/insights/' as any, { body } as any), 'create insight') as RemoteInsight,
    createCohort: async (body) => ok(await c.POST('/cohorts/' as any, { body } as any), 'create cohort') as RemoteCohort,
    updateDashboard: async (id, body) => ok(await c.PATCH(`/dashboards/{id}/` as any, { params: { path: { id } }, body } as any), 'update dashboard') as RemoteDashboard,
    updateInsight: async (id, body) => ok(await c.PATCH(`/insights/{id}/` as any, { params: { path: { id } }, body } as any), 'update insight') as RemoteInsight,
    updateCohort: async (id, body) => ok(await c.PATCH(`/cohorts/{id}/` as any, { params: { path: { id } }, body } as any), 'update cohort') as RemoteCohort,
    deleteDashboard: async (id) => { await c.DELETE(`/dashboards/{id}/` as any, { params: { path: { id } } } as any); },
    deleteInsight: async (id) => { await c.DELETE(`/insights/{id}/` as any, { params: { path: { id } } } as any); },
    deleteCohort: async (id) => { await c.DELETE(`/cohorts/{id}/` as any, { params: { path: { id } } } as any); },
  };
}

function formatPlanSummary(plan: SyncPlan): string {
  const lines: string[] = [];
  for (const item of plan.create) lines.push(`[create]  ${item.kind} ${item.local.slug}`);
  for (const item of plan.update) lines.push(`[update]  ${item.kind} ${item.local.slug}  (posthog_id=${item.remoteId})`);
  for (const item of plan.orphan) lines.push(`[orphan]  ${item.kind} "${item.remote.name}" (posthog_id=${item.remote.id})`);
  if (lines.length === 0) lines.push('(nothing to do)');
  return lines.join('\n');
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const wantPlan = args.includes('--plan');
  const wantApply = args.includes('--apply');
  const deleteOrphans = args.includes('--delete-orphans');
  if (!wantPlan && !wantApply) {
    console.error('Usage: sync.ts (--plan | --apply [--delete-orphans])');
    return 1;
  }
  if (wantPlan && wantApply) {
    console.error('Cannot combine --plan and --apply');
    return 1;
  }

  const here = dirname(fileURLToPath(import.meta.url));
  const root = resolvePath(here);  // tools/posthog/

  let client: SyncClient;
  try {
    client = makeRealClient();
  } catch (err) {
    console.error(`Failed to initialize PostHog client: ${err instanceof Error ? err.message : err}`);
    return 1;
  }

  let plan: SyncPlan;
  try {
    plan = await computePlan({ root, client });
  } catch (err) {
    console.error(`Plan computation failed: ${err instanceof Error ? err.message : err}`);
    return 1;
  }

  console.log(formatPlanSummary(plan));

  if (wantPlan) return 0;

  const result = await applyPlan({ root, client, plan, deleteOrphans });
  console.log(`\napplied: ${result.applied}, failed: ${result.failed}`);
  if (result.errors.length > 0) {
    for (const e of result.errors) {
      console.error(`  ${e.kind} ${e.slug}: ${e.error}`);
    }
    return 1;
  }

  // Helpful next-step hint after apply with writeback.
  // A create item is "written back" only if it succeeded (not in result.errors).
  const failedSlugs = new Set(result.errors.map((e) => e.slug));
  const writeback = plan.create.filter((p) => !failedSlugs.has(p.local.slug));
  if (writeback.length > 0) {
    const slugs = writeback.map((p) => p.local.slug).join(', ');
    console.log(`\nWriteback complete. Commit with:`);
    console.log(`  git add tools/posthog/{dashboards,insights,cohorts}/`);
    console.log(`  git commit -m "chore(posthog): writeback ids for ${slugs}"`);
  }
  return 0;
}

// Only run main when executed directly (not when imported by tests).
const isDirectRun = process.argv[1] && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().then((code) => process.exit(code));
}
