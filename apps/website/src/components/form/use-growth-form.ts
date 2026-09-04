'use client';
import { useCallback, useRef, useState } from 'react';
import { track } from '../../lib/analytics/client';
import type { AnalyticsEventName, AnalyticsProperties } from '../../lib/analytics/events';
import type { PublicFormPolicy } from '../../lib/growth/form-policy';
import {
  growthFormRequestSnapshot,
  type GrowthFormFacts,
  type GrowthFormRequestSnapshot,
} from '../../lib/growth/form-client';

export type GrowthFormStatus = 'idle' | 'pending' | 'sent' | 'failed' | 'stale';

export type GrowthFormRoute = '/api/leads' | '/api/newsletter' | '/api/whitepaper-signup';

export interface UseGrowthFormOptions {
  route: GrowthFormRoute;
  formPolicy: PublicFormPolicy;
  events: { submit: AnalyticsEventName; success: AnalyticsEventName; fail: AnalyticsEventName };
  /** Sent with every event: surface, source_section, paper, entry_point. */
  analytics: AnalyticsProperties;
}

export interface GrowthFormController<Facts extends GrowthFormFacts> {
  status: GrowthFormStatus;
  /** Posts the facts. Resolves after the status has settled; never throws. */
  submit: (facts: Facts) => Promise<void>;
  /** Back to idle; keeps the snapshot so a retry after reset still reuses its id. */
  reset: () => void;
}

/**
 * One implementation of the flow every lead surface used to copy:
 * immutable request snapshot, growth envelope, stale-policy branch, analytics.
 * 409 means the visitor's page holds an old policy version; any 4xx discards
 * the snapshot so the next attempt is a fresh submission.
 */
export function useGrowthForm<Facts extends GrowthFormFacts = GrowthFormFacts>(
  options: UseGrowthFormOptions
): GrowthFormController<Facts> {
  const { route, formPolicy, events, analytics } = options;
  const [status, setStatus] = useState<GrowthFormStatus>('idle');
  const snapshotRef = useRef<GrowthFormRequestSnapshot<Facts> | null>(null);

  const submit = useCallback(
    async (facts: Facts) => {
      setStatus('pending');
      track(events.submit, analytics);
      try {
        const snapshot = growthFormRequestSnapshot<Facts>(snapshotRef.current, facts);
        snapshotRef.current = snapshot;
        const response = await fetch(route, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...snapshot.facts,
            acquisition_session_id: snapshot.acquisition_session_id,
            submission_id: snapshot.submission_id,
            policy_version: formPolicy.version,
          }),
        });
        if (response.status === 409) {
          snapshotRef.current = null;
          setStatus('stale');
          return;
        }
        if (response.status >= 400 && response.status < 500) {
          snapshotRef.current = null;
        }
        if (response.ok) {
          snapshotRef.current = null;
          track(events.success, analytics);
          setStatus('sent');
          return;
        }
        track(events.fail, { ...analytics, error_reason: 'api_error' });
        setStatus('failed');
      } catch {
        track(events.fail, { ...analytics, error_reason: 'network_error' });
        setStatus('failed');
      }
    },
    [route, formPolicy.version, events, analytics]
  );

  const reset = useCallback(() => setStatus('idle'), []);

  return { status, submit, reset };
}
