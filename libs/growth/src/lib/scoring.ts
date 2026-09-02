import { createHash } from 'node:crypto';

import type { SqlExecutor } from './database.ts';
import type { FormOutreachApprovedActivityData } from './models.ts';

export const GROWTH_SCORE_POLICY_VERSION = 'growth-score-policy:v1' as const;

export type GrowthScoreTier = 'low' | 'medium' | 'high' | 'very_high';
export type GrowthScoreContentFamily =
  | 'architecture'
  | 'comparison'
  | 'pricing'
  | 'security'
  | 'deployment';

export interface GrowthScoreContentRegistryEntry {
  contentId: string;
  family: GrowthScoreContentFamily;
}

export interface GrowthScoreContentRegistry {
  version: string;
  entries: readonly GrowthScoreContentRegistryEntry[];
}

export interface GrowthScoreActivity {
  eventKey: string;
  contactId: string | null;
  projectId: string | null;
  kind: string;
  occurredAt: Date;
  data: Record<string, unknown>;
}

export interface GrowthScoreReason {
  code:
    | 'content.architecture_or_comparison'
    | 'content.pricing_security_deployment'
    | 'docs.install_command_copied'
    | 'transport.connected'
    | 'runtime.first_stream_completed'
    | 'thread.persisted'
    | 'interrupt.handled'
    | 'generative_ui.rendered'
    | 'project.returned_7d'
    | 'contact.approved_work_email_form';
  points: number;
  identifiers: string[];
}

export interface GrowthScoreResult {
  subject: { type: 'contact' | 'project'; id: string };
  score: number;
  tier: GrowthScoreTier;
  policyVersion: typeof GROWTH_SCORE_POLICY_VERSION;
  registryVersion: string;
  registryHash: string;
  scoreVersion: string;
  reasons: GrowthScoreReason[];
}

interface ActivityRow extends Record<string, unknown> {
  event_key: string;
  contact_id: string | null;
  project_id: string | null;
  kind: string;
  occurred_at: Date | string;
  data: Record<string, unknown>;
}

interface ValidatedRegistry {
  version: string;
  hash: string;
  families: ReadonlyMap<string, GrowthScoreContentFamily>;
}

const CONTENT_FAMILIES = new Set<GrowthScoreContentFamily>([
  'architecture',
  'comparison',
  'pricing',
  'security',
  'deployment',
]);

const PROJECT_SIGNAL_POINTS = {
  'transport.connected': 15,
  'runtime.first_stream_completed': 20,
  'thread.persisted': 15,
  'interrupt.handled': 15,
  'generative_ui.rendered': 15,
  'project.returned_7d': 15,
} as const;

type ProjectSignal = keyof typeof PROJECT_SIGNAL_POINTS;

export function growthScoreTierFor(score: number): GrowthScoreTier {
  if (!Number.isFinite(score) || score < 0) {
    throw new Error('growth score must be a finite non-negative number');
  }
  if (score >= 70) return 'very_high';
  if (score >= 40) return 'high';
  if (score >= 15) return 'medium';
  return 'low';
}

function requiredScopeId(field: string, value: string): string {
  if (value.trim().length === 0 || value !== value.trim()) {
    throw new Error(`${field} must be a non-empty canonical identifier`);
  }
  return value;
}

function validateRegistry(
  registry: GrowthScoreContentRegistry
): ValidatedRegistry {
  const version = registry.version;
  if (
    typeof version !== 'string' ||
    version.trim().length === 0 ||
    version !== version.trim() ||
    version.length > 100
  ) {
    throw new Error('growth score registry version is malformed');
  }
  if (!Array.isArray(registry.entries)) {
    throw new Error('growth score registry entries must be an array');
  }

  const sorted = registry.entries
    .map((entry) => {
      if (
        !entry ||
        typeof entry.contentId !== 'string' ||
        entry.contentId.trim().length === 0 ||
        entry.contentId !== entry.contentId.trim() ||
        entry.contentId.length > 200 ||
        !CONTENT_FAMILIES.has(entry.family)
      ) {
        throw new Error('growth score registry entry is malformed');
      }
      return { contentId: entry.contentId, family: entry.family };
    })
    .sort((left, right) =>
      left.contentId === right.contentId
        ? left.family.localeCompare(right.family)
        : left.contentId.localeCompare(right.contentId)
    );

  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index]?.contentId === sorted[index - 1]?.contentId) {
      throw new Error(
        `growth score registry contains duplicate content ID: ${sorted[index]?.contentId}`
      );
    }
  }

  const canonical = JSON.stringify({ entries: sorted, version });
  return {
    version,
    hash: createHash('sha256').update(canonical).digest('hex'),
    families: new Map(
      sorted.map(({ contentId, family }) => [contentId, family])
    ),
  };
}

function registeredQualifyingContent(
  activity: GrowthScoreActivity,
  registry: ValidatedRegistry
): { contentId: string; family: GrowthScoreContentFamily } | null {
  if (activity.kind !== 'marketing:content_engaged') return null;
  if (activity.data['qualifying_projection'] !== true) return null;
  const contentId = activity.data['content_id'];
  if (typeof contentId !== 'string') return null;
  const family = registry.families.get(contentId);
  return family ? { contentId, family } : null;
}

function pushReason(
  reasons: GrowthScoreReason[],
  code: GrowthScoreReason['code'],
  points: number,
  identifiers: Iterable<string>
): void {
  if (points === 0) return;
  reasons.push({ code, points, identifiers: [...identifiers].sort() });
}

function isVerifiedWorkApproval(
  activity: GrowthScoreActivity
): activity is GrowthScoreActivity & {
  data: FormOutreachApprovedActivityData;
} {
  if (activity.kind !== 'form.outreach_approved') return false;
  const data = activity.data;
  return (
    data['email_classification'] === 'work' &&
    data['verification'] === 'server_verified' &&
    typeof data['policy_version'] === 'string' &&
    data['policy_version'].length > 0 &&
    typeof data['source'] === 'string' &&
    data['source'].length > 0 &&
    typeof data['source_form'] === 'string' &&
    data['source_form'].length > 0
  );
}

function isAuthoritativeProjection(activity: GrowthScoreActivity): boolean {
  return activity.data['qualifying_projection'] === true;
}

function scoreScopedActivities(
  subject: GrowthScoreResult['subject'],
  activities: readonly GrowthScoreActivity[],
  contentRegistry: GrowthScoreContentRegistry
): GrowthScoreResult {
  const registry = validateRegistry(contentRegistry);
  const reasons: GrowthScoreReason[] = [];
  const architectureOrComparison = new Set<string>();
  const pricingSecurityDeployment = new Set<string>();

  for (const activity of activities) {
    const content = registeredQualifyingContent(activity, registry);
    if (!content) continue;
    if (content.family === 'architecture' || content.family === 'comparison') {
      architectureOrComparison.add(content.contentId);
    } else {
      pricingSecurityDeployment.add(content.contentId);
    }
  }

  const architectureIds = [...architectureOrComparison].sort().slice(0, 3);
  const highIntentIds = [...pricingSecurityDeployment].sort().slice(0, 2);
  pushReason(
    reasons,
    'content.architecture_or_comparison',
    architectureIds.length * 5,
    architectureIds
  );
  pushReason(
    reasons,
    'content.pricing_security_deployment',
    highIntentIds.length * 10,
    highIntentIds
  );

  if (
    activities.some(
      (activity) =>
        activity.kind === 'docs:install_command_copied' &&
        isAuthoritativeProjection(activity)
    )
  ) {
    pushReason(reasons, 'docs.install_command_copied', 5, ['once']);
  }

  for (const [signal, points] of Object.entries(PROJECT_SIGNAL_POINTS) as [
    ProjectSignal,
    number
  ][]) {
    const projectIds = new Set(
      activities
        .filter(
          (activity) =>
            activity.kind === signal &&
            activity.projectId !== null &&
            isAuthoritativeProjection(activity)
        )
        .map(({ projectId }) => projectId as string)
    );
    pushReason(reasons, signal, projectIds.size * points, projectIds);
  }

  if (activities.some(isVerifiedWorkApproval)) {
    pushReason(reasons, 'contact.approved_work_email_form', 30, ['once']);
  }

  const score = reasons.reduce((total, reason) => total + reason.points, 0);
  return {
    subject,
    score,
    tier: growthScoreTierFor(score),
    policyVersion: GROWTH_SCORE_POLICY_VERSION,
    registryVersion: registry.version,
    registryHash: registry.hash,
    scoreVersion: `${GROWTH_SCORE_POLICY_VERSION}+registry:${registry.version}+sha256:${registry.hash}`,
    reasons,
  };
}

export function scoreProjectActivities(input: {
  projectId: string;
  activities: readonly GrowthScoreActivity[];
  contentRegistry: GrowthScoreContentRegistry;
}): GrowthScoreResult {
  const projectId = requiredScopeId('projectId', input.projectId);
  return scoreScopedActivities(
    { type: 'project', id: projectId },
    input.activities.filter(
      ({ projectId: activityProjectId }) => activityProjectId === projectId
    ),
    input.contentRegistry
  );
}

function scoreContactActivitySet(input: {
  contactId: string;
  activities: readonly GrowthScoreActivity[];
  contentRegistry: GrowthScoreContentRegistry;
}): GrowthScoreResult {
  const contactId = requiredScopeId('contactId', input.contactId);
  return scoreScopedActivities(
    { type: 'contact', id: contactId },
    input.activities,
    input.contentRegistry
  );
}

function toActivity(row: ActivityRow): GrowthScoreActivity {
  return {
    eventKey: row.event_key,
    contactId: row.contact_id,
    projectId: row.project_id,
    kind: row.kind,
    occurredAt: new Date(row.occurred_at),
    data: row.data,
  };
}

export async function recomputeProjectScore(
  executor: SqlExecutor,
  input: {
    projectId: string;
    contentRegistry: GrowthScoreContentRegistry;
  }
): Promise<GrowthScoreResult> {
  const result = await executor.execute<ActivityRow>(
    `/* growth:read-project-score-activities */
     select event_key, contact_id, project_id, kind, occurred_at, data
     from growth_activity
     where project_id = $1
     order by occurred_at, id`,
    [input.projectId]
  );
  return scoreProjectActivities({
    projectId: input.projectId,
    activities: result.rows.map(toActivity),
    contentRegistry: input.contentRegistry,
  });
}

export async function recomputeContactScore(
  executor: SqlExecutor,
  input: {
    contactId: string;
    contentRegistry: GrowthScoreContentRegistry;
  }
): Promise<GrowthScoreResult> {
  const result = await executor.execute<ActivityRow>(
    `/* growth:read-contact-score-activities */
     select a.event_key, a.contact_id, a.project_id,
            a.kind, a.occurred_at, a.data
     from growth_activity a
     where (
          a.contact_id = $1
          and a.project_id is null
          and (
            a.kind = 'form.outreach_approved'
            or a.data->>'qualifying_projection' = 'true'
          )
        )
        or (
          a.contact_id is null
          and a.data->>'qualifying_projection' = 'true'
          and exists (
            select 1
            from growth_projects p
            where p.id = a.project_id
              and p.contact_id = $1
              and p.claim_consumed_at is not null
              and p.claim_method = 'one_time_secret'
              and exists (
                select 1
                from growth_activity claim
                where claim.project_id = p.id
                  and claim.contact_id = $1
                  and claim.kind = 'project.claimed'
                  and claim.occurred_at = p.claim_consumed_at
                  and claim.data->>'claim_method' = 'one_time_secret'
                  and claim.data->>'relationship' = 'self_claimed_project'
              )
          )
        )
     order by a.occurred_at, a.id`,
    [input.contactId]
  );
  return scoreContactActivitySet({
    contactId: input.contactId,
    activities: result.rows.map(toActivity),
    contentRegistry: input.contentRegistry,
  });
}
