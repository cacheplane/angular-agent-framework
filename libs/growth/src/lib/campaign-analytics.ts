export const CAMPAIGN_ANALYTICS_SCHEMA_VERSION = 1 as const;

export type CampaignAggregateOutcome =
  | 'enrolled'
  | 'step_accepted'
  | 'step_delivered'
  | 'reply'
  | 'stopped'
  | 'bounced'
  | 'complained'
  | 'suppressed'
  | 'provider_unknown'
  | 'provider_failed';

export interface CampaignAggregateEvent {
  schemaVersion: typeof CAMPAIGN_ANALYTICS_SCHEMA_VERSION;
  outcome: CampaignAggregateOutcome;
  step?: 1 | 2 | 3;
}

const OUTCOMES = {
  'campaign.enrolled:v1': 'enrolled',
  'campaign.step_accepted': 'step_accepted',
  'delivery.delivered': 'step_delivered',
  'campaign.reply_received': 'reply',
  unsubscribe: 'stopped',
  manual_suppression: 'stopped',
  deletion: 'stopped',
  invalid_address: 'stopped',
  hard_bounce: 'bounced',
  complaint: 'complained',
  provider_suppression: 'suppressed',
  'delivery.acceptance_unknown': 'provider_unknown',
  'delivery.provider_rejected': 'provider_failed',
  'delivery.failed': 'provider_failed',
} as const satisfies Record<string, CampaignAggregateOutcome>;

export function toCampaignAggregateEvent(
  candidate: unknown
): CampaignAggregateEvent {
  if (
    candidate === null ||
    typeof candidate !== 'object' ||
    Array.isArray(candidate) ||
    Object.getPrototypeOf(candidate) !== Object.prototype
  ) {
    throw new Error('Campaign analytics source must be a plain object');
  }
  const record = candidate as Record<string, unknown>;
  const keys = Reflect.ownKeys(record);
  if (keys.some((key) => key !== 'kind' && key !== 'step')) {
    throw new Error('Campaign analytics source contains identifying data');
  }
  if (!Object.hasOwn(record, 'kind')) {
    throw new Error('Campaign analytics source requires an own kind');
  }
  const kind = record['kind'];
  if (typeof kind !== 'string' || !Object.hasOwn(OUTCOMES, kind)) {
    throw new Error('Campaign analytics source kind is not registered');
  }
  const outcome = OUTCOMES[kind as keyof typeof OUTCOMES];
  const requiresStep =
    outcome === 'step_accepted' || outcome === 'step_delivered';
  const step = record['step'];
  if (requiresStep) {
    if (
      !Object.hasOwn(record, 'step') ||
      (step !== 1 && step !== 2 && step !== 3)
    ) {
      throw new Error('Campaign step outcome requires step 1, 2, or 3');
    }
    return {
      schemaVersion: CAMPAIGN_ANALYTICS_SCHEMA_VERSION,
      outcome,
      step,
    };
  }
  if (step !== undefined) {
    throw new Error('Campaign non-step outcome cannot contain a step');
  }
  return { schemaVersion: CAMPAIGN_ANALYTICS_SCHEMA_VERSION, outcome };
}
