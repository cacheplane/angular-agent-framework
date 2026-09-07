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
    if (
      claim.citations.length !== 1 ||
      claim.text !== claim.citations[0]?.quote
    )
      reasons.add('claim_not_exact_excerpt');
    const key = claim.text.trim().toLowerCase();
    if (seen.has(key)) reasons.add('duplicate_claim');
    seen.add(key);
    for (const citation of claim.citations) {
      const reason = citationReason(citation, c);
      if (reason) reasons.add(reason);
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

function citationReason(
  citation: { sourceId: string; quote: string },
  c: PilotCase
) {
  const page = c.pages.find((_, i) => citation.sourceId === `source-${i + 1}`);
  if (!page) return 'invalid_source' as const;
  if (
    ![...page.facts, ...page.snippets].some((text) =>
      text.includes(citation.quote)
    )
  )
    return 'quote_not_found' as const;
  return undefined;
}

/** Tool-facing repair locations; persisted validation stays compact and unchanged. */
export function invalidCitations(value: unknown, c: PilotCase) {
  const parsed = CandidateSchema.safeParse(value);
  if (!parsed.success) return [];
  return parsed.data.claims.flatMap((claim, claimIndex) =>
    claim.citations.flatMap((citation, citationIndex) => {
      const reason = citationReason(citation, c);
      return reason ? [{ claimIndex, citationIndex, reason }] : [];
    })
  );
}
