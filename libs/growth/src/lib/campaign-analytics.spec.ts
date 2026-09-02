import * as publicGrowth from '../index.ts';
import { describe, expect, it } from 'vitest';

import {
  CAMPAIGN_ANALYTICS_SCHEMA_VERSION,
  toCampaignAggregateEvent,
} from './campaign-analytics.ts';

describe('closed campaign analytics taxonomy', () => {
  it.each([
    ['campaign.enrolled:v1', 'enrolled'],
    ['campaign.step_accepted', 'step_accepted'],
    ['delivery.delivered', 'step_delivered'],
    ['campaign.reply_received', 'reply'],
    ['manual_suppression', 'stopped'],
    ['hard_bounce', 'bounced'],
    ['complaint', 'complained'],
    ['provider_suppression', 'suppressed'],
    ['delivery.acceptance_unknown', 'provider_unknown'],
    ['delivery.provider_rejected', 'provider_failed'],
    ['delivery.failed', 'provider_failed'],
  ] as const)('maps %s to the closed %s outcome', (kind, outcome) => {
    expect(
      toCampaignAggregateEvent({
        kind,
        ...(kind === 'campaign.step_accepted' || kind === 'delivery.delivered'
          ? { step: 2 }
          : {}),
      })
    ).toEqual({
      schemaVersion: CAMPAIGN_ANALYTICS_SCHEMA_VERSION,
      outcome,
      ...(kind === 'campaign.step_accepted' || kind === 'delivery.delivered'
        ? { step: 2 }
        : {}),
    });
  });

  it('rejects arbitrary properties and identifying/provider/copy fields', () => {
    for (const candidate of [
      { kind: 'campaign.enrolled:v1', email: 'ada@example.com' },
      { kind: 'campaign.enrolled:v1', contactId: 'contact-1' },
      { kind: 'campaign.step_accepted', step: 1, providerId: 'provider-1' },
      { kind: 'campaign.step_accepted', step: 1, copy: 'message body' },
      { kind: 'arbitrary.outcome' },
    ]) {
      expect(() => toCampaignAggregateEvent(candidate)).toThrow();
    }
  });

  it.each(['constructor', 'toString', '__proto__'])(
    'rejects prototype key %s as an unregistered outcome',
    (kind) => {
      expect(() => toCampaignAggregateEvent({ kind })).toThrow(/registered/u);
    }
  );

  it('rejects inherited kind or step properties and non-plain records', () => {
    const inheritedKind = Object.create({ kind: 'campaign.enrolled:v1' });
    const inheritedStep = Object.assign(Object.create({ step: 2 }), {
      kind: 'campaign.step_accepted',
    });
    const nullPrototype = Object.assign(Object.create(null), {
      kind: 'campaign.enrolled:v1',
    });
    class AggregateCandidate {
      kind = 'campaign.enrolled:v1';
    }

    for (const candidate of [
      inheritedKind,
      inheritedStep,
      nullPrototype,
      new AggregateCandidate(),
    ]) {
      expect(() => toCampaignAggregateEvent(candidate)).toThrow(/object|own/u);
    }
  });

  it('rejects non-enumerable and symbol property bags', () => {
    const hidden = { kind: 'campaign.enrolled:v1' };
    Object.defineProperty(hidden, 'contactId', {
      enumerable: false,
      value: 'contact-1',
    });
    const symbolKey = Object.assign(
      { kind: 'campaign.enrolled:v1' },
      { [Symbol('provider-id')]: 'provider-1' }
    );

    expect(() => toCampaignAggregateEvent(hidden)).toThrow(/identifying/u);
    expect(() => toCampaignAggregateEvent(symbolKey)).toThrow(/identifying/u);
  });

  it('exports only the pure versioned mapper and taxonomy from growth', () => {
    expect(publicGrowth.toCampaignAggregateEvent).toBe(
      toCampaignAggregateEvent
    );
    expect(publicGrowth).not.toHaveProperty('emitCampaignAnalytics');
    expect(publicGrowth).not.toHaveProperty('captureCampaignAnalytics');
  });
});
