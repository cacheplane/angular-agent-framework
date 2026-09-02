import {
  normalizeRecipientEmail,
  type FormSubmission,
} from '@threadplane-internal/growth';

import { matchesSubmittedFormPolicy } from '../../../lib/growth/form-policy';
import {
  defaultGrowthFormRouteDependencies,
  jsonResponse,
  readBoundedJsonObject,
  stalePolicyResponse,
  strictOptionalEnum,
  strictText,
  validGrowthFormIdentities,
  type GrowthFormRouteDependencies,
} from '../../../lib/growth/form-route';

const MAX_BODY_BYTES = 16_384;

const TEAM_SIZES = ['1-5', '6-25', '26-100', '100+'] as const;
const TIMELINES = [
  'this_quarter',
  'next_quarter',
  '6_plus_months',
  'exploring',
] as const;
const PILOT_INTERESTS = ['yes', 'maybe', 'no'] as const;

export function createLeadRoute(
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

      try {
        const policyVersion = strictText(body, 'policy_version', 100);
        if (!matchesSubmittedFormPolicy(policy, policyVersion || undefined)) {
          return stalePolicyResponse(policy);
        }
      } catch {
        return jsonResponse({ error: 'Invalid form submission' }, 400);
      }

      const formKind = body['form_kind'];
      if (formKind !== 'contact' && formKind !== 'pricing') {
        return jsonResponse({ error: 'Invalid form' }, 400);
      }

      let submissionId;
      let acquisitionSessionId;
      let email;
      let name;
      let company;
      let message;
      let teamSize;
      let timeline;
      let pilotInterest;
      try {
        submissionId = strictText(body, 'submission_id', 36);
        acquisitionSessionId = strictText(body, 'acquisition_session_id', 36);
        email = strictText(body, 'email', 254);
        name = strictText(body, 'name', 200);
        company = strictText(body, 'company', 200);
        message = strictText(body, 'message', 2_000);
        teamSize = strictOptionalEnum(body, 'team_size', TEAM_SIZES);
        timeline = strictOptionalEnum(body, 'timeline', TIMELINES);
        pilotInterest = strictOptionalEnum(
          body,
          'pilot_interest',
          PILOT_INTERESTS
        );
      } catch {
        return jsonResponse({ error: 'Invalid form submission' }, 400);
      }
      if (!validGrowthFormIdentities(submissionId, acquisitionSessionId)) {
        return jsonResponse({ error: 'Invalid submission' }, 400);
      }

      let normalizedEmail;
      try {
        normalizedEmail = normalizeRecipientEmail(email);
      } catch {
        return jsonResponse({ error: 'Valid email required' }, 400);
      }

      const form: FormSubmission =
        formKind === 'contact'
          ? { kind: 'contact', ...(message ? { message } : {}) }
          : {
              kind: 'pricing',
              ...(message ? { message } : {}),
              ...(teamSize ? { teamSize } : {}),
              ...(timeline ? { timeline } : {}),
              ...(pilotInterest ? { pilotInterest } : {}),
            };

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
          companyName: company || undefined,
          form,
          source: 'website',
          sourceForm: formKind,
          noticeText: policy.disclosures.contact,
          noticeVersion: `${policy.version}.${formKind}`,
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

export const { POST } = createLeadRoute();
