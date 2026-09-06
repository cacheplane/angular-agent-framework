import { submitCandidate, getPilotContext } from '../../../../pilot/context.js';
import { invalidCitations } from '../../../../pilot/validation.js';
import { CandidateSchema } from '../../../../pilot/contracts.js';

// Dawn's supported authored schema export preserves nullable fields and the
// exact same bounds used by deterministic submission validation.
export const schema = CandidateSchema;
/** Submit a structurally checked company candidate. Each claim text must equal its one citation quote, a verbatim source excerpt. */
export default async function tool(input: {
  profile: {
    name: string | null;
    description: string | null;
    industry: string | null;
  };
  unknowns: ('name' | 'description' | 'industry')[];
  claims: { text: string; citations: { sourceId: string; quote: string }[] }[];
}) {
  const validation = submitCandidate(input);
  const context = getPilotContext();
  if (validation.status !== 'rejected' || !context) return validation;
  const errors = invalidCitations(input, context.case);
  return errors.length ||
    validation.reasonCodes.includes('claim_not_exact_excerpt')
    ? {
        ...validation,
        invalidCitations: errors,
        citationInstruction:
          'Indices are zero-based. Replace each invalid citation with one citationOptions object from readEvidence, or a shorter contiguous excerpt within one option. Never join options. Set each claim.text exactly equal to its sole citation.quote. Use separate claims for separate excerpts; remove unsupported claims.',
      }
    : validation;
}
