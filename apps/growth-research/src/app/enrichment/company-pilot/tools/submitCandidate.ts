import { submitCandidate } from '../../../../pilot/context.js';
import { CandidateSchema } from '../../../../pilot/contracts.js';

// Dawn's supported authored schema export preserves nullable fields and the
// exact same bounds used by deterministic submission validation.
export const schema = CandidateSchema;
/** Submit a structurally checked company candidate. Excerpts must occur verbatim in a cited source. */
export default async function tool(input: {
  profile: {
    name: string | null;
    description: string | null;
    industry: string | null;
  };
  unknowns: ('name' | 'description' | 'industry')[];
  claims: { text: string; citations: { sourceId: string; quote: string }[] }[];
}) {
  return submitCandidate(input);
}
