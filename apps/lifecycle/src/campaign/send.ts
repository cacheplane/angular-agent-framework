import {
  authorizeLeasedJobForSubmission,
  assertRecipientDeliveryPolicy,
  cancelLeasedJob,
  classifyResendProviderError,
  claimInternalNotificationSubmission,
  completeLeasedJob,
  createGrowthActionToken,
  createUnsubscribeActionUrl,
  deferLeasedJob,
  failLeasedJob,
  JobLeaseConflictError,
  loadGrowthTokenKeyring,
  markProviderAcceptanceUnknown,
  markInternalNotificationUnknown,
  markProviderRejection,
  normalizeGrowthPublicActionOrigin,
  normalizeRecipientEmail,
  persistJobArtifact,
  readLifecycleJobContext,
  readInstallRuntimeEnrichmentContext,
  recordProviderAcceptance,
  RECIPIENT_EMAIL_SENDER,
  recomputeContactScore,
  sendRecipientEmail,
  unsubscribeActionUrlValue,
  type DeliveryEnvironment,
  type GrowthArtifact,
  type GrowthDispatchResult,
  type GrowthJob,
  type GrowthScoreReason,
  type GrowthTokenKey,
  type RecipientDeliveryPolicy,
  type RecipientEmailInput,
  type RecipientSendResult,
  type SqlExecutor,
  type CampaignTemplateId,
  type UnsubscribeActionUrl,
} from '../growth.js';
import { Resend } from 'resend';

import { generateEnrichmentArtifact } from '../enrichment/anthropic.js';
import { createCompanyCapture } from '../enrichment/company-capture.js';
import {
  createDawnJobHandlers,
  type DawnJobDependencies,
} from '../enrichment/dawn-jobs.js';
import { buildResearchInput } from '../enrichment/research-input.js';
import {
  EnrichmentArtifactSchema,
  type CompanyPageEvidence,
  type EnrichmentArtifact,
} from '../enrichment/schema.js';
import { renderFulfillmentTemplate } from '../fulfillment/templates.js';
import { renderInternalNotificationSummary } from '../notifications/templates.js';
import { DeterministicLifecycleJobError } from '../job-errors.js';
import { LIFECYCLE_SCORE_CONTENT_REGISTRY_V1 } from '../score-policy.js';
export { LIFECYCLE_SCORE_CONTENT_REGISTRY_V1 } from '../score-policy.js';
import {
  renderCampaignTemplate,
  renderEvidenceCampaignTemplate,
  type CampaignDraft,
  type CampaignStep,
} from './templates.js';

const STEP_NAMES: Record<1 | 2 | 3, CampaignStep> = {
  1: 'immediate',
  2: 'day-3',
  3: 'day-8',
};
const RETRY_DELAY_MS = 60_000;

export interface LifecycleJobContext {
  contactId: string;
  displayName: string | null;
  companyName: string | null;
  companyDomain: string | null;
  emailClassification: 'work' | 'personal' | 'unknown';
  formSubmission: Record<string, unknown>;
  enrollmentAt: Date | null;
  campaignEnrollmentReason?: 'install_runtime' | null;
  enrichmentArtifact: GrowthArtifact | null;
}

interface LeasedTransitionInput {
  jobId: string;
  leaseToken: string;
  now: Date;
  errorCode?: string;
}

interface DeferLeasedJobInput extends LeasedTransitionInput {
  availableAt: Date;
}

export interface LifecycleJobDependencies {
  readInstallRuntimeEnrichmentContext: typeof readInstallRuntimeEnrichmentContext;
  now: () => Date;
  readJobContext: (
    executor: SqlExecutor,
    input: { jobId: string }
  ) => Promise<LifecycleJobContext>;
  createUnsubscribeUrl: (
    input: { contactId: string; issuedAt: Date; eventNonce?: string },
    key: GrowthTokenKey
  ) => UnsubscribeActionUrl;
  sendRecipient: (
    executor: SqlExecutor,
    input: RecipientEmailInput,
    policy: RecipientDeliveryPolicy
  ) => Promise<RecipientSendResult>;
  deferJob: (
    executor: SqlExecutor,
    input: DeferLeasedJobInput
  ) => Promise<GrowthJob>;
  completeJob: (
    executor: SqlExecutor,
    input: LeasedTransitionInput
  ) => Promise<GrowthJob>;
  cancelJob: (
    executor: SqlExecutor,
    input: LeasedTransitionInput
  ) => Promise<GrowthJob>;
  claimInternalNotification: (
    executor: SqlExecutor,
    input: { jobId: string; leaseToken: string; now: Date }
  ) => Promise<boolean>;
  markInternalNotificationUnknown: (
    executor: SqlExecutor,
    input: {
      jobId: string;
      leaseToken: string;
      occurredAt: Date;
      errorCode: string;
    }
  ) => Promise<GrowthJob>;
  failJob: (
    executor: SqlExecutor,
    input: LeasedTransitionInput
  ) => Promise<GrowthJob>;
  fetchCompanyEvidence: (
    companyDomain: string,
    signal: AbortSignal
  ) => Promise<CompanyPageEvidence[]>;
  readDeterministicScore: (
    executor: SqlExecutor,
    contactId: string
  ) => Promise<{
    score: number;
    scoreVersion: string;
    reasons: GrowthScoreReason[];
  }>;
  generateArtifact: (
    input: ReturnType<typeof buildResearchInput>,
    signal: AbortSignal
  ) => Promise<EnrichmentArtifact>;
  persistArtifact: (
    executor: SqlExecutor,
    input: {
      jobId: string;
      leaseToken: string;
      now: Date;
      kind: string;
      schemaVersion: number;
      content: Record<string, unknown>;
    }
  ) => Promise<GrowthArtifact>;
  sendInternalNotification: (input: {
    to: string;
    subject: string;
    text: string;
    idempotencyKey: string;
  }) => Promise<{ outcome: 'accepted' | 'rejected' | 'unknown' }>;
  founderNotificationEmail: string;
  recipientPolicy: RecipientDeliveryPolicy;
  tokenKey: GrowthTokenKey;
}

export interface LifecycleRuntimeConfiguration {
  campaignEnrollmentEnabled: boolean;
  installRuntimeHelloEnabled: boolean;
  campaignEnrollmentStartAt?: Date;
  campaignEnabled: boolean;
  deliveryEnabled: boolean;
  environment?: DeliveryEnvironment;
}

type RuntimeEnvironment = Record<string, string | undefined>;

export type PreparedCampaignMessage = {
  status: 'ready';
  subject: string;
  text: string;
  html: string;
  /** The template id that rendered this message, attributed as a provider tag. */
  template: CampaignTemplateId;
};

type SelectedCampaignDraft = CampaignDraft & {
  readonly template: CampaignTemplateId;
};

function campaignStep(job: GrowthJob): 1 | 2 | 3 {
  const step = job.payload['step'];
  if (
    job.kind !== 'send_step' ||
    job.payload['campaign_version'] !== 'v1' ||
    (step !== 1 && step !== 2 && step !== 3)
  ) {
    throw new DeterministicLifecycleJobError(
      'Invalid campaign send_step payload'
    );
  }
  return step;
}

function validArtifact(
  stored: GrowthArtifact | null,
  contactId: string
): EnrichmentArtifact | null {
  if (
    !stored ||
    stored.kind !== 'enrichment.v1' ||
    stored.schemaVersion !== 1 ||
    stored.contactId !== contactId
  ) {
    return null;
  }
  const parsed = EnrichmentArtifactSchema.safeParse(stored.content);
  if (!parsed.success) return null;
  const sourceIds = new Set(parsed.data.sources.map(({ id }) => id));
  if (sourceIds.size !== parsed.data.sources.length) return null;
  const citedIds = new Set(
    parsed.data.cited_signals.flatMap(({ source_ids }) => source_ids)
  );
  if (
    [...citedIds].some((id) => !sourceIds.has(id)) ||
    parsed.data.sources.some(({ id }) => !citedIds.has(id))
  ) {
    return null;
  }
  return parsed.data;
}

function draftFor(
  step: 1 | 2 | 3,
  artifact: EnrichmentArtifact | null
): SelectedCampaignDraft {
  // Every step is the founder session offer. A cited research angle only
  // changes which flavor of that offer goes out.
  if (artifact) {
    const selection = artifact.drafts[step - 1];
    const cited =
      selection !== null &&
      artifact.cited_signals.some(({ source_ids }) =>
        source_ids.includes(selection.source_id)
      );
    if (selection !== null && cited) {
      return {
        ...renderEvidenceCampaignTemplate(selection.angle_id, {
          finalStep: step === 3,
        }),
        template: selection.angle_id,
      };
    }
  }
  return {
    ...renderCampaignTemplate(STEP_NAMES[step]),
    template: STEP_NAMES[step],
  };
}

const FIRST_NAME_PATTERN = /^[A-Za-z][A-Za-z'’-]{0,29}$/u;
const PLAIN_NAME_PATTERN = /^[A-Za-z'’.-]+(?:\s[A-Za-z'’.-]+){0,5}$/u;

/**
 * "Hey <first name>," when the persisted display name is a plain name and its
 * first word is a plain first name; otherwise "Hey there,". Campaign steps and
 * fulfillment mail both open with it. Display names are
 * free-text form input, so a name carrying digits, punctuation, or a URL
 * anywhere is discarded as a whole and never reaches the email.
 */
export function campaignGreeting(
  displayName: string | null | undefined
): string {
  const name = (displayName ?? '').trim();
  if (name.length > 60 || !PLAIN_NAME_PATTERN.test(name)) return 'Hey there,';
  const first = name.split(/\s+/u)[0] ?? '';
  return FIRST_NAME_PATTERN.test(first) ? `Hey ${first},` : 'Hey there,';
}

function signedText(
  body: string,
  unsubscribeUrl: UnsubscribeActionUrl
): string {
  return `${body}\n\n—\nBrian\n\nIs this email not relevant to you? Stop here: ${unsubscribeActionUrlValue(
    unsubscribeUrl
  )}`;
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
const BODY_LINK_PATTERN = /https:\/\/[^\s<>()"'“”‘’\]}]+/gu;

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/gu,
    (character) => HTML_ESCAPES[character] ?? character
  );
}

function htmlLine(line: string): string {
  let rendered = '';
  let cursor = 0;
  for (const match of line.matchAll(BODY_LINK_PATTERN)) {
    const start = match.index;
    const trailing = /[.,;:!]+$/u.exec(match[0])?.[0] ?? '';
    const link = match[0].slice(0, match[0].length - trailing.length);
    rendered += escapeHtml(line.slice(cursor, start));
    rendered += `<a href="${escapeHtml(link)}">${escapeHtml(link)}</a>`;
    rendered += escapeHtml(trailing);
    cursor = start + match[0].length;
  }
  return rendered + escapeHtml(line.slice(cursor));
}

/**
 * A plain HTML alternative for the text part: the same paragraphs, bare HTTPS
 * links as anchors, and a one-word unsubscribe link instead of the long signed
 * URL. No layout, images, styles, or tracking.
 */
function signedHtml(
  body: string,
  unsubscribeUrl: UnsubscribeActionUrl
): string {
  const paragraphs = body
    .split('\n\n')
    .map((paragraph) => paragraph.split('\n').map(htmlLine).join('<br>'))
    .map((paragraph) => `<p>${paragraph}</p>`);
  const unsubscribe = escapeHtml(unsubscribeActionUrlValue(unsubscribeUrl));
  return [
    ...paragraphs,
    '<p>—<br>Brian</p>',
    `<p>Is this email not relevant to you? Click <a href="${unsubscribe}">here</a>.</p>`,
  ].join('\n');
}

export function prepareCampaignMessage(input: {
  context: LifecycleJobContext;
  job: GrowthJob;
  unsubscribeUrl: UnsubscribeActionUrl;
}): PreparedCampaignMessage {
  const genericHello =
    input.context.campaignEnrollmentReason === 'install_runtime';
  const artifact = genericHello
    ? null
    : validArtifact(input.context.enrichmentArtifact, input.context.contactId);
  const draft = draftFor(campaignStep(input.job), artifact);
  const body = `${campaignGreeting(input.context.displayName)}\n\n${
    draft.body
  }`;
  return {
    status: 'ready',
    subject: draft.subject,
    text: signedText(body, input.unsubscribeUrl),
    html: signedHtml(body, input.unsubscribeUrl),
    template: draft.template,
  };
}

function requireLease(job: GrowthJob): string {
  if (job.status !== 'leased' || !job.leaseToken) {
    throw new Error(`Inactive lifecycle job: ${job.id}`);
  }
  return job.leaseToken;
}

function fulfillmentInput(payload: Record<string, unknown>): unknown {
  const formKind = payload['form_kind'];
  if (formKind === 'whitepaper') {
    return { context: 'whitepaper', paper: payload['paper'] };
  }
  if (
    formKind === 'newsletter' ||
    formKind === 'contact' ||
    formKind === 'pricing'
  ) {
    return { context: formKind };
  }
  throw new DeterministicLifecycleJobError(
    'Unsupported fulfillment form context'
  );
}

function formSource(
  value: unknown
): 'whitepaper' | 'newsletter' | 'contact' | 'pricing' | 'project-claim' {
  if (
    value === 'whitepaper' ||
    value === 'newsletter' ||
    value === 'contact' ||
    value === 'pricing' ||
    value === 'project-claim'
  ) {
    return value;
  }
  throw new DeterministicLifecycleJobError('Persisted form kind is invalid');
}

function enrichmentDrafts(context: LifecycleJobContext): CampaignDraft[] {
  const artifact = validArtifact(context.enrichmentArtifact, context.contactId);
  return ([1, 2, 3] as const).map((step) => {
    const { subject, body } = draftFor(step, artifact);
    return { subject, body };
  });
}

async function dispatchRecipient(
  executor: SqlExecutor,
  job: GrowthJob,
  subject: string,
  text: string,
  html: string,
  unsubscribeUrl: UnsubscribeActionUrl,
  signal: AbortSignal,
  dependencies: LifecycleJobDependencies,
  campaignTemplate?: CampaignTemplateId
): Promise<GrowthDispatchResult> {
  const leaseToken = requireLease(job);
  signal.throwIfAborted();
  const result = await dependencies.sendRecipient(
    executor,
    {
      jobId: job.id,
      leaseToken,
      subject,
      text,
      html,
      unsubscribeUrl,
      signal,
      ...(campaignTemplate === undefined ? {} : { campaignTemplate }),
    },
    dependencies.recipientPolicy
  );
  if (result.accepted) return 'completed';
  if (result.reason === 'mailbox_recovery_required') return 'recovery_paused';
  if (
    result.reason === 'campaign_disabled' ||
    result.reason === 'delivery_disabled'
  ) {
    const now = dependencies.now();
    await dependencies.deferJob(executor, {
      jobId: job.id,
      leaseToken,
      now,
      availableAt: new Date(now.getTime() + RETRY_DELAY_MS),
      errorCode: result.reason,
    });
    return 'deferred';
  }
  if (
    result.reason === 'contact_deleted' ||
    result.reason === 'contact_stopped' ||
    result.reason === 'contact_unapproved'
  ) {
    await dependencies.cancelJob(executor, {
      jobId: job.id,
      leaseToken,
      now: dependencies.now(),
      errorCode: result.reason,
    });
    return 'cancelled';
  }
  return 'failed';
}

export async function dispatchLifecycleAppOwnedJob(
  executor: SqlExecutor,
  job: GrowthJob,
  dispatchContext: { signal?: AbortSignal },
  dependencies: LifecycleJobDependencies
): Promise<GrowthDispatchResult> {
  const leaseToken = requireLease(job);
  const signal = dispatchContext.signal ?? new AbortController().signal;
  signal.throwIfAborted();
  const now = dependencies.now();
  const context = await dependencies.readJobContext(executor, {
    jobId: job.id,
  });
  signal.throwIfAborted();
  if (context.contactId !== job.contactId) {
    throw new DeterministicLifecycleJobError(
      'Lifecycle context contact does not match the leased job'
    );
  }

  if (job.kind === 'fulfill') {
    let message: ReturnType<typeof renderFulfillmentTemplate>;
    try {
      message = renderFulfillmentTemplate(fulfillmentInput(job.payload));
    } catch (error) {
      if (error instanceof DeterministicLifecycleJobError) throw error;
      throw new DeterministicLifecycleJobError(
        `Persisted fulfillment input is invalid: ${
          error instanceof Error ? error.message : 'unknown validation error'
        }`
      );
    }
    const unsubscribeUrl = dependencies.createUnsubscribeUrl(
      { contactId: context.contactId, issuedAt: now, eventNonce: job.id },
      dependencies.tokenKey
    );
    // Fulfillment mail is the first message a contact gets from Brian, so it
    // opens the same way every campaign step does.
    const body = `${campaignGreeting(context.displayName)}\n\n${message.body}`;
    return dispatchRecipient(
      executor,
      job,
      message.subject,
      signedText(body, unsubscribeUrl),
      signedHtml(body, unsubscribeUrl),
      unsubscribeUrl,
      signal,
      dependencies
    );
  }

  if (job.kind === 'send_step') {
    const unsubscribeUrl = dependencies.createUnsubscribeUrl(
      { contactId: context.contactId, issuedAt: now, eventNonce: job.id },
      dependencies.tokenKey
    );
    const message = prepareCampaignMessage({
      context,
      job,
      unsubscribeUrl,
    });
    return dispatchRecipient(
      executor,
      job,
      message.subject,
      message.text,
      message.html,
      unsubscribeUrl,
      signal,
      dependencies,
      message.template
    );
  }

  if (job.kind === 'enrich') {
    try {
      const installRuntime = job.payload['source'] === 'install_runtime';
      const installContext = installRuntime
        ? await dependencies.readInstallRuntimeEnrichmentContext(executor, {
            jobId: job.id,
            leaseToken,
            now: dependencies.now(),
          })
        : null;
      if (installRuntime && !installContext) {
        await dependencies.cancelJob(executor, {
          jobId: job.id,
          leaseToken,
          now: dependencies.now(),
          errorCode: 'install_runtime_evidence_unavailable',
        });
        return 'cancelled';
      }
      const companyDomain = installRuntime
        ? installContext?.companyDomain
        : context.companyDomain;
      const deterministicScore = await dependencies.readDeterministicScore(
        executor,
        context.contactId
      );
      signal.throwIfAborted();
      const companyPages =
        (installRuntime || context.emailClassification !== 'personal') &&
        companyDomain
          ? await dependencies.fetchCompanyEvidence(companyDomain, signal)
          : [];
      signal.throwIfAborted();
      const paper = context.formSubmission['paper'];
      const pilotInterest = context.formSubmission['pilot_interest'];
      const teamSize = context.formSubmission['team_size'];
      const timeline = context.formSubmission['timeline'];
      const researchInput = buildResearchInput({
        formFacts: {
          ...(installRuntime
            ? {
                source: 'install_runtime',
                emailClassification: 'unknown',
                companyDomain,
              }
            : {
                source: formSource(context.formSubmission['form_kind']),
                emailClassification: context.emailClassification,
                ...(context.displayName
                  ? { displayName: context.displayName }
                  : {}),
                ...(context.companyName
                  ? { companyName: context.companyName }
                  : {}),
                ...(context.companyDomain
                  ? { companyDomain: context.companyDomain }
                  : {}),
                ...(paper === 'overview' ||
                paper === 'angular' ||
                paper === 'render' ||
                paper === 'chat'
                  ? { paper }
                  : {}),
                ...(pilotInterest === 'yes' ||
                pilotInterest === 'maybe' ||
                pilotInterest === 'no'
                  ? { pilotInterest }
                  : {}),
                ...(teamSize === '1-5' ||
                teamSize === '6-25' ||
                teamSize === '26-100' ||
                teamSize === '100+'
                  ? { teamSize }
                  : {}),
                ...(timeline === 'this_quarter' ||
                timeline === 'next_quarter' ||
                timeline === '6_plus_months' ||
                timeline === 'exploring'
                  ? { timeline }
                  : {}),
              }),
        },
        deterministicScore,
        companyPages,
      });
      if (installRuntime) {
        const current = await dependencies.readInstallRuntimeEnrichmentContext(
          executor,
          { jobId: job.id, leaseToken, now: dependencies.now() }
        );
        signal.throwIfAborted();
        if (!current || current.companyDomain !== companyDomain) {
          await dependencies.cancelJob(executor, {
            jobId: job.id,
            leaseToken,
            now: dependencies.now(),
            errorCode: 'install_runtime_evidence_unavailable',
          });
          return 'cancelled';
        }
      }
      const artifact = await dependencies.generateArtifact(
        researchInput,
        signal
      );
      signal.throwIfAborted();
      const artifactAt = dependencies.now();
      await dependencies.persistArtifact(executor, {
        jobId: job.id,
        leaseToken,
        now: artifactAt,
        kind: 'enrichment.v1',
        schemaVersion: 1,
        content: artifact,
      });
      signal.throwIfAborted();
      await dependencies.completeJob(executor, {
        jobId: job.id,
        leaseToken,
        now: dependencies.now(),
      });
      return 'completed';
    } catch (error) {
      signal.throwIfAborted();
      if (error instanceof DeterministicLifecycleJobError) throw error;
      if (
        job.payload['source'] === 'install_runtime' &&
        error instanceof JobLeaseConflictError
      ) {
        // Stop/redaction or another worker already owns the durable state.
        // Cancel this dispatch without attempting another transition on its revoked lease.
        return 'cancelled';
      }
      if (job.attempts < 2) {
        const retryAt = dependencies.now();
        await dependencies.deferJob(executor, {
          jobId: job.id,
          leaseToken,
          now: retryAt,
          availableAt: new Date(retryAt.getTime() + RETRY_DELAY_MS),
          errorCode: 'enrichment_retry',
        });
        return 'deferred';
      }
      await dependencies.failJob(executor, {
        jobId: job.id,
        leaseToken,
        now: dependencies.now(),
        errorCode: 'enrichment_failed',
      });
      return 'failed';
    }
  }

  if (job.kind === 'notify') {
    if (!dependencies.recipientPolicy.deliveryEnabled) {
      const retryAt = dependencies.now();
      await dependencies.deferJob(executor, {
        jobId: job.id,
        leaseToken,
        now: retryAt,
        availableAt: new Date(retryAt.getTime() + RETRY_DELAY_MS),
        errorCode: 'delivery_disabled',
      });
      return 'deferred';
    }
    const notificationClaimedAt = dependencies.now();
    const parsed = validArtifact(context.enrichmentArtifact, context.contactId);
    const founderStopToken = createGrowthActionToken(
      {
        contactId: context.contactId,
        purpose: 'founder_stop',
        issuedAt: notificationClaimedAt,
        eventNonce: job.id,
      },
      dependencies.tokenKey
    );
    const text = renderInternalNotificationSummary({
      scoreVersion: parsed?.score_version ?? 'growth-score:v1:unscored',
      scoreReasons: parsed?.score_reasons ?? [],
      evidenceSourceUrls: parsed?.sources.map(({ url }) => url) ?? [],
      drafts: enrichmentDrafts(context),
      founderStopUrl: `https://threadplane.ai/api/growth/stop?token=${founderStopToken}`,
    });
    signal.throwIfAborted();
    const claimed = await dependencies.claimInternalNotification(executor, {
      jobId: job.id,
      leaseToken,
      now: notificationClaimedAt,
    });
    if (!claimed) {
      await dependencies.markInternalNotificationUnknown(executor, {
        jobId: job.id,
        leaseToken,
        occurredAt: dependencies.now(),
        errorCode: 'internal_notification_outcome_unknown',
      });
      signal.throwIfAborted();
      return 'failed';
    }
    signal.throwIfAborted();
    const sent = await dependencies.sendInternalNotification({
      to: dependencies.founderNotificationEmail,
      subject: 'Threadplane lifecycle review',
      text,
      idempotencyKey: job.idempotencyKey,
    });
    if (sent.outcome === 'unknown') {
      await dependencies.markInternalNotificationUnknown(executor, {
        jobId: job.id,
        leaseToken,
        occurredAt: dependencies.now(),
        errorCode: 'internal_notification_outcome_unknown',
      });
      return 'failed';
    }
    if (sent.outcome === 'rejected') {
      await dependencies.failJob(executor, {
        jobId: job.id,
        leaseToken,
        now: dependencies.now(),
        errorCode: 'internal_notification_rejected',
      });
      return 'failed';
    }
    await dependencies.completeJob(executor, {
      jobId: job.id,
      leaseToken,
      now: dependencies.now(),
    });
    return 'completed';
  }

  throw new DeterministicLifecycleJobError(
    `Unsupported app-owned growth job kind: ${job.kind}`
  );
}

function exactBoolean(
  environment: Record<string, string | undefined>,
  name: string
): boolean {
  const value = environment[name];
  if (value === undefined || value === 'false') return false;
  if (value === 'true') return true;
  throw new Error(`${name} must be exactly true or false`);
}

export function loadLifecycleRuntimeConfiguration(
  environment: RuntimeEnvironment
): LifecycleRuntimeConfiguration {
  const campaignEnrollmentEnabled = exactBoolean(
    environment,
    'CAMPAIGN_ENROLLMENT_ENABLED'
  );
  const campaignEnabled = exactBoolean(environment, 'CAMPAIGN_ENABLED');
  const installRuntimeHelloEnabled = exactBoolean(
    environment,
    'GROWTH_INSTALL_RUNTIME_HELLO_ENABLED'
  );
  const deliveryEnabled = exactBoolean(environment, 'DELIVERY_ENABLED');
  let campaignEnrollmentStartAt: Date | undefined;
  if (campaignEnrollmentEnabled) {
    const raw = environment['CAMPAIGN_ENROLLMENT_START_AT'];
    campaignEnrollmentStartAt =
      raw && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(raw)
        ? new Date(raw)
        : undefined;
    if (
      !campaignEnrollmentStartAt ||
      Number.isNaN(campaignEnrollmentStartAt.getTime()) ||
      campaignEnrollmentStartAt.toISOString() !== raw
    ) {
      throw new Error(
        'CAMPAIGN_ENROLLMENT_START_AT must be canonical UTC RFC3339 with milliseconds when enrollment is enabled'
      );
    }
  }
  return {
    campaignEnrollmentEnabled,
    installRuntimeHelloEnabled,
    ...(campaignEnrollmentStartAt ? { campaignEnrollmentStartAt } : {}),
    campaignEnabled,
    deliveryEnabled,
  };
}

function deliveryEnvironment(
  environment: RuntimeEnvironment,
  name: string
): DeliveryEnvironment {
  const value = environment[name];
  if (value === 'production' || value === 'preview' || value === 'test') {
    return value;
  }
  throw new Error(`${name} must be production, preview, or test`);
}

function requiredEnvironmentText(
  environment: RuntimeEnvironment,
  name: string
): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function requiredEnvironmentCanonicalValue(
  environment: RuntimeEnvironment,
  name: string
): string {
  const value = environment[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function recipientPolicyFromEnvironment(
  environment: RuntimeEnvironment,
  runtime: LifecycleRuntimeConfiguration
): RecipientDeliveryPolicy {
  const delivery = deliveryEnvironment(environment, 'DELIVERY_ENVIRONMENT');
  const database = deliveryEnvironment(
    environment,
    'GROWTH_DATABASE_ENVIRONMENT'
  );
  const allowlist = (environment['RESEND_NON_PRODUCTION_ALLOWLIST'] ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const redirect = environment['RESEND_NON_PRODUCTION_REDIRECT_TO']?.trim();
  return {
    campaignEnabled: runtime.campaignEnabled,
    deliveryEnabled: runtime.deliveryEnabled,
    environment: delivery,
    databaseEnvironment: database,
    senderVerified: exactBoolean(environment, 'RESEND_SENDER_VERIFIED'),
    verifiedDomain: 'threadplane.ai',
    configuredSender: RECIPIENT_EMAIL_SENDER,
    providerTrackingDisabled: exactBoolean(
      environment,
      'RESEND_TRACKING_DISABLED'
    ),
    nonProductionRecipientAllowlist: allowlist,
    ...(redirect ? { nonProductionRedirectTo: redirect } : {}),
  };
}

export function createDefaultLifecycleJobDependencies(
  environment: RuntimeEnvironment = process.env
): LifecycleJobDependencies {
  const runtime = loadLifecycleRuntimeConfiguration(environment);
  const now = (): Date => new Date();
  let cachedMailRuntime:
    | {
        founderNotificationEmail: string;
        recipientPolicy: RecipientDeliveryPolicy;
        publicActionOrigin: string;
        resend: Resend;
        tokenKey: GrowthTokenKey;
      }
    | undefined;
  const mailRuntime = () => {
    if (cachedMailRuntime) return cachedMailRuntime;
    const apiKey = requiredEnvironmentText(environment, 'RESEND_API_KEY');
    const founderNotificationEmail = normalizeRecipientEmail(
      requiredEnvironmentText(environment, 'FOUNDER_NOTIFICATION_EMAIL')
    );
    const recipientPolicy = recipientPolicyFromEnvironment(
      environment,
      runtime
    );
    assertRecipientDeliveryPolicy(recipientPolicy);
    if (
      recipientPolicy.environment !== 'production' &&
      !recipientPolicy.nonProductionRecipientAllowlist
        .map((email) => normalizeRecipientEmail(email))
        .includes(founderNotificationEmail)
    ) {
      throw new Error(
        'The configured founder notification address must be on the non-production allowlist'
      );
    }
    const publicActionOrigin = normalizeGrowthPublicActionOrigin(
      requiredEnvironmentCanonicalValue(
        environment,
        'GROWTH_PUBLIC_ACTION_ORIGIN'
      )
    );
    cachedMailRuntime = {
      founderNotificationEmail,
      recipientPolicy,
      publicActionOrigin,
      resend: new Resend(apiKey),
      tokenKey: loadGrowthTokenKeyring(environment).active,
    };
    return cachedMailRuntime;
  };

  return {
    now,
    readJobContext: readLifecycleJobContext,
    readInstallRuntimeEnrichmentContext,
    createUnsubscribeUrl: (input, key) =>
      createUnsubscribeActionUrl(input, key, mailRuntime().publicActionOrigin),
    sendRecipient: (executor, input, policy) => {
      const { resend } = mailRuntime();
      return sendRecipientEmail(executor, input, policy, {
        now,
        resend,
        authorizeLeasedJobForSubmission,
        recordProviderAcceptance,
        markProviderAcceptanceUnknown,
        markProviderRejection,
      });
    },
    deferJob: deferLeasedJob,
    completeJob: completeLeasedJob,
    cancelJob: cancelLeasedJob,
    claimInternalNotification: claimInternalNotificationSubmission,
    markInternalNotificationUnknown,
    failJob: failLeasedJob,
    fetchCompanyEvidence: createCompanyCapture(environment),
    async readDeterministicScore(executor, contactId) {
      const score = await recomputeContactScore(executor, {
        contactId,
        contentRegistry: LIFECYCLE_SCORE_CONTENT_REGISTRY_V1,
      });
      return {
        score: score.score,
        scoreVersion: score.scoreVersion,
        reasons: score.reasons,
      };
    },
    generateArtifact: generateEnrichmentArtifact,
    persistArtifact: persistJobArtifact,
    async sendInternalNotification(input) {
      const { founderNotificationEmail, recipientPolicy, resend } =
        mailRuntime();
      if (normalizeRecipientEmail(input.to) !== founderNotificationEmail) {
        throw new Error('Internal notification recipient is not the founder');
      }
      try {
        const response = await resend.emails.send(
          {
            from: RECIPIENT_EMAIL_SENDER,
            to: founderNotificationEmail,
            subject: input.subject,
            text: input.text,
            tags: [
              { name: 'environment', value: recipientPolicy.environment },
              { name: 'job_kind', value: 'notify' },
            ],
          },
          { idempotencyKey: `internal:${input.idempotencyKey}` }
        );
        if (response.error === null) {
          const providerId = response.data?.id;
          return typeof providerId === 'string' &&
            /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u.test(providerId)
            ? { outcome: 'accepted' as const }
            : { outcome: 'unknown' as const };
        }
        return {
          outcome: classifyResendProviderError(response.error),
        };
      } catch {
        return { outcome: 'unknown' as const };
      }
    },
    get founderNotificationEmail() {
      return mailRuntime().founderNotificationEmail;
    },
    get recipientPolicy() {
      return mailRuntime().recipientPolicy;
    },
    get tokenKey() {
      return mailRuntime().tokenKey;
    },
  };
}

export function createLifecycleAppJobHandlers(
  dependenciesFactory: () => LifecycleJobDependencies = () =>
    createDefaultLifecycleJobDependencies(),
  options: {
    environment?: Record<string, string | undefined>;
    dawnDependenciesFactory?: () => DawnJobDependencies;
  } = {}
) {
  const dawn = createDawnJobHandlers(options.dawnDependenciesFactory);
  const handler = (
    executor: SqlExecutor,
    job: GrowthJob,
    context: { signal?: AbortSignal }
  ) =>
    dispatchLifecycleAppOwnedJob(executor, job, context, dependenciesFactory());
  return {
    fulfill: handler,
    enrich: (
      executor: SqlExecutor,
      job: GrowthJob,
      context: { signal?: AbortSignal }
    ) =>
      (options.environment ?? process.env)['GROWTH_DAWN_ENRICHMENT_ENABLED'] ===
        'true' || 'research_attempt' in job.payload
        ? dawn.enrich(executor, job, context)
        : handler(executor, job, context),
    research_cleanup: dawn.research_cleanup,
    notify: handler,
    send_step: handler,
  };
}
