// The website intentionally consumes the growth library through its internal boundary.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { normalizeRecipientEmail } from '@threadplane-internal/growth';

import { matchesSubmittedFormPolicy } from '../../../lib/growth/form-policy';
import {
  defaultGrowthFormRouteDependencies,
  formAdmissionError,
  trustedFormClientIp,
  jsonResponse,
  readBoundedJsonObject,
  stalePolicyResponse,
  strictText,
  validGrowthFormIdentities,
  type GrowthFormRouteDependencies,
} from '../../../lib/growth/form-route';

const MAX_BODY_BYTES = 8_192;

export function createNewsletterRoute(
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

      let honeypot;
      let submissionId;
      let acquisitionSessionId;
      let email;
      try {
        const policyVersion = strictText(body, 'policy_version', 100);
        if (!matchesSubmittedFormPolicy(policy, policyVersion || undefined)) {
          return stalePolicyResponse(policy);
        }
        honeypot = strictText(body, 'website_url', 200);
        submissionId = strictText(body, 'submission_id', 36);
        acquisitionSessionId = strictText(body, 'acquisition_session_id', 36);
        email = strictText(body, 'email', 254);
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

      let database;
      let keyring;
      try {
        keyring = dependencies.loadKeyring();
        database = dependencies.createDatabase();
      } catch {
        return jsonResponse({ error: 'Unable to accept request' }, 503);
      }

      let accepted = false;
      const trustedClientIp = trustedFormClientIp(request);
      let deliverySuppressed = false;
      let admissionError: Response | undefined;
      try {
        const result = await dependencies.accept(database, {
          ...(honeypot ? { honeypot } : {}),
          ...(trustedClientIp ? { trustedClientIp } : {}),
          submissionId,
          email: normalizedEmail,
          form: { kind: 'newsletter' },
          source: 'website',
          sourceForm: 'newsletter',
          noticeText: policy.disclosures.newsletter,
          noticeVersion: `${policy.version}.newsletter`,
          policyVersion: policy.version,
          acquisitionSessionId: acquisitionSessionId || undefined,
          occurredAt: dependencies.now(),
          keyring,
        });
        accepted = true;
        deliverySuppressed = result.deliverySuppressed === true;
      } catch (error) {
        admissionError = formAdmissionError(error);
        // The response below reports the failure without echoing provider detail.
      }

      try {
        await database.close?.();
      } catch {
        return unableToAccept();
      }
      if (admissionError) return admissionError;
      if (!accepted) return unableToAccept();
      if (deliverySuppressed) return jsonResponse({ ok: true });

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

export const { POST } = createNewsletterRoute();
