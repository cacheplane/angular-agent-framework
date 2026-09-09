import 'server-only';

export const GROWTH_FORM_POLICY_VERSION = 'growth_v1.2026-09-09';

/**
 * Deliberately no longer an outreach disclosure, hence the rename: it makes no
 * statement about the follow-up sequence, which whitepaper signups are still
 * enrolled into (`apps/lifecycle/src/campaign/send.ts` treats formKind
 * 'whitepaper' as a campaign context). Changed on request; the policy version
 * is bumped alongside it so consent captured under the previous wording stays
 * distinguishable from consent captured under this one.
 */
export const WHITEPAPER_PRIVACY_ASSURANCE =
  'We will never spam you or share your email address.';
export const CONTACT_OUTREACH_DISCLOSURE =
  'By sending, you agree Brian may follow up by email about your request.';
export const NEWSLETTER_OUTREACH_DISCLOSURE =
  'Subscribe to Threadplane updates and a short, three-email welcome from Brian. Unsubscribe anytime.';

export interface PublicFormPolicy {
  mode: 'growth_v1';
  version: typeof GROWTH_FORM_POLICY_VERSION;
  disclosures: {
    contact: string;
    newsletter: string;
    whitepaper: string;
  };
}

const GROWTH_V1_POLICY: PublicFormPolicy = Object.freeze({
  mode: 'growth_v1',
  version: GROWTH_FORM_POLICY_VERSION,
  disclosures: Object.freeze({
    contact: CONTACT_OUTREACH_DISCLOSURE,
    newsletter: NEWSLETTER_OUTREACH_DISCLOSURE,
    whitepaper: WHITEPAPER_PRIVACY_ASSURANCE,
  }),
});

export function getFormPolicy(
  environment: Readonly<Record<string, string | undefined>> = process.env
): PublicFormPolicy {
  if (environment['GROWTH_FORM_POLICY']?.trim() !== 'growth_v1') {
    throw new Error('GROWTH_FORM_POLICY must be growth_v1');
  }
  return GROWTH_V1_POLICY;
}

export function matchesSubmittedFormPolicy(
  policy: PublicFormPolicy,
  submittedVersion: string | undefined
): boolean {
  return submittedVersion === policy.version;
}
