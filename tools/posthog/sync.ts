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
