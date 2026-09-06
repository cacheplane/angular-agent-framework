import { createHash } from 'node:crypto';
import { CorpusSchema, type Corpus, type PilotCase } from './contracts.js';
export { sourceIds } from './contracts.js';
export const evidenceHash = (page: { facts: string[]; snippets: string[] }) =>
  createHash('sha256')
    .update(JSON.stringify({ facts: page.facts, snippets: page.snippets }))
    .digest('hex');
export const corpusHash = (corpus: Corpus) =>
  createHash('sha256').update(JSON.stringify(corpus)).digest('hex');
export function validateCorpus(value: unknown): Corpus {
  const corpus = CorpusSchema.parse(value);
  if (new Set(corpus.cases.map((c) => c.kind)).size !== 1)
    throw new Error('mixed corpus kinds');
  const ids = new Set<string>();
  for (const c of corpus.cases) {
    if (ids.has(c.id)) throw new Error('duplicate case');
    ids.add(c.id);
    for (const page of c.pages) {
      if (c.kind === 'synthetic' && page.contentHash !== evidenceHash(page))
        throw new Error('content hash mismatch');
      const host = new URL(page.canonicalUrl).hostname;
      if (host !== c.domain && host !== `www.${c.domain}`)
        throw new Error('source domain mismatch');
      if (
        /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(JSON.stringify(page))
      )
        throw new Error('identity content forbidden');
    }
  }
  return corpus;
}
export function caseEvidence(c: PilotCase) {
  return c.pages.map((page, i) => ({ sourceId: `source-${i + 1}`, ...page }));
}
