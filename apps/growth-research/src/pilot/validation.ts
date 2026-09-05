import {
  CandidateSchema,
  type PilotCase,
  type Validation,
} from './contracts.js';
export function validateCandidate(value: unknown, c: PilotCase): Validation {
  const parsed = CandidateSchema.safeParse(value);
  if (!parsed.success) return { status: 'rejected', reasonCodes: ['schema'] };
  const reasons = new Set<string>();
  const seen = new Set<string>();
  if (
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(
      JSON.stringify(parsed.data)
    )
  )
    reasons.add('identity_content');
  if (
    parsed.data.claims.length === 0 &&
    Object.values(parsed.data.profile).some((value) => value !== null)
  )
    reasons.add('profile_without_claims');
  for (const claim of parsed.data.claims) {
    const key = claim.text.trim().toLowerCase();
    if (seen.has(key)) reasons.add('duplicate_claim');
    seen.add(key);
    for (const citation of claim.citations) {
      const index = c.pages.findIndex(
        (_, i) => citation.sourceId === `source-${i + 1}`
      );
      const page = c.pages[index];
      if (!page) reasons.add('invalid_source');
      else if (
        ![...page.facts, ...page.snippets].some((text) =>
          text.includes(citation.quote)
        )
      )
        reasons.add('quote_not_found');
    }
  }
  for (const field of ['name', 'description', 'industry'] as const)
    if (
      (parsed.data.profile[field] === null) !==
      parsed.data.unknowns.includes(field)
    )
      reasons.add('unknown_mismatch');
  if (new Set(parsed.data.unknowns).size !== parsed.data.unknowns.length)
    reasons.add('duplicate_unknown');
  return {
    status: reasons.size ? 'rejected' : 'structurally_valid',
    reasonCodes: [...reasons],
  };
}
