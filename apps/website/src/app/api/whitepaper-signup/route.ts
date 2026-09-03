// The website intentionally consumes the growth library through its internal boundary.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { normalizeRecipientEmail } from '@threadplane-internal/growth';

import { matchesSubmittedFormPolicy } from '../../../lib/growth/form-policy';
import {
  defaultGrowthFormRouteDependencies,
  jsonResponse,
  readBoundedJsonObject,
  stalePolicyResponse,
  strictText,
  validGrowthFormIdentities,
  type GrowthFormRouteDependencies,
} from '../../../lib/growth/form-route';

const MAX_BODY_BYTES = 16_384;

type PaperId = 'overview' | 'angular' | 'render' | 'chat';

const VALID_PAPERS: readonly PaperId[] = [
  'overview',
  'angular',
  'render',
  'chat',
];

export function createWhitepaperSignupRoute(
  dependencies: GrowthFormRouteDependencies = defaultGrowthFormRouteDependencies()
): { POST: (request: Request) => Promise<Response> } {
  return {
    async POST(request: Request): Promise<Response> {
      const body = await readBoundedJsonObject(request, MAX_BODY_BYTES);
      if (!body) return jsonResponse({ error: 'Invalid JSON' }, 400);

      let policy;
      try {
        policy = dependencies.getPolicy();
      } catch {
        return jsonResponse({ error: 'Unable to accept request' }, 503);
      }

      let submissionId;
      let acquisitionSessionId;
      let name;
      let email;
      let submittedPaper;
      try {
        const policyVersion = strictText(body, 'policy_version', 100);
        if (!matchesSubmittedFormPolicy(policy, policyVersion || undefined)) {
          return stalePolicyResponse(policy);
        }
        submissionId = strictText(body, 'submission_id', 36);
        acquisitionSessionId = strictText(body, 'acquisition_session_id', 36);
        name = strictText(body, 'name', 200);
        email = strictText(body, 'email', 254);
        submittedPaper = strictText(body, 'paper', 20) || 'overview';
      } catch {
        return jsonResponse({ error: 'Invalid form submission' }, 400);
      }
      if (!validGrowthFormIdentities(submissionId, acquisitionSessionId)) {
        return jsonResponse({ error: 'Invalid submission' }, 400);
      }
      if (!VALID_PAPERS.includes(submittedPaper as PaperId)) {
        return jsonResponse({ error: 'Invalid paper' }, 400);
      }

      let normalizedEmail;
      try {
        normalizedEmail = normalizeRecipientEmail(email);
      } catch {
        return jsonResponse({ error: 'Valid email required' }, 400);
      }

      let database;
      let keyring;
      try {
        keyring = dependencies.loadKeyring();
        database = dependencies.createDatabase();
      } catch {
        return jsonResponse({ error: 'Unable to accept request' }, 503);
      }

      let accepted = false;
      try {
        await dependencies.accept(database, {
          submissionId,
          email: normalizedEmail,
          displayName: name || undefined,
          form: { kind: 'whitepaper', paper: submittedPaper as PaperId },
          source: 'website',
          sourceForm: 'whitepaper',
          noticeText: policy.disclosures.whitepaper,
          noticeVersion: `${policy.version}.whitepaper`,
          policyVersion: policy.version,
          acquisitionSessionId: acquisitionSessionId || undefined,
          occurredAt: dependencies.now(),
          keyring,
        });
        accepted = true;
      } catch {
        // The response below reports the failure without echoing provider detail.
      }

      try {
        await database.close?.();
      } catch {
        return unableToAccept();
      }
      if (!accepted) return unableToAccept();

      // The durable jobs remain available to the scheduled dispatcher.
      await dependencies.nudge({ submissionId }).catch(() => undefined);
      return jsonResponse({ ok: true });
    },
  };
}

function unableToAccept(): Response {
  return jsonResponse(
    { error: 'Unable to accept request', retryable: true },
    503
  );
}

export const { POST } = createWhitepaperSignupRoute();
