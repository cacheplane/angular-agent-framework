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

  for (const tier of tiers) {
    for (const item of tier.create) {
      if (dryRun) continue;
      // Resolve tiles outside the try — unknown insight slug is a data error
      // that must surface, not a per-item network failure.
      const tiles = item.kind === 'dashboard' ? resolveTiles(item.local, insightSlugToId) : null;
      try {
        let created: any;
        if (item.kind === 'cohort') created = await client.createCohort(item.local);
        else if (item.kind === 'insight') created = await client.createInsight(item.local);
        else {
          created = await client.createDashboard({ ...item.local, tiles });
        }
        if (item.kind === 'insight') insightSlugToId.set(item.local.slug, created.id);
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
      const tiles = item.kind === 'dashboard' ? resolveTiles(item.local, insightSlugToId) : null;
      try {
        if (item.kind === 'cohort') await client.updateCohort(item.remoteId!, item.local);
        else if (item.kind === 'insight') await client.updateInsight(item.remoteId!, item.local);
        else {
          await client.updateDashboard(item.remoteId!, { ...item.local, tiles });
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
