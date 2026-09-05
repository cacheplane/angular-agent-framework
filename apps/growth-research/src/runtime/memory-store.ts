import { createHash } from 'node:crypto';
import { pgvectorMemoryStore, type PgvectorMemoryStore } from '@dawn-ai/memory-pgvector';

export const syntheticEmbedder = {
  id: 'growth-synthetic-sha256-v1',
  dims: 8,
  async embed(texts: readonly string[]): Promise<Float32Array[]> {
    return texts.map(text => {
      const digest = createHash('sha256').update(text).digest();
      return Float32Array.from({ length: 8 }, (_, index) => digest.readUInt32BE(index * 4) / 0xffffffff);
    });
  },
};

// Server-owned fixture slot, never read from a user message or route parameter.
// This proves synthetic addressing only; it is not authenticated tenant scope.
export function trustedFixtureScope(): { workspace: 'growth-research'; agent: 'atlas' | 'beacon' } {
  const slot = process.env['GROWTH_RESEARCH_FIXTURE_SLOT'] ?? 'atlas';
  if (slot !== 'atlas' && slot !== 'beacon') throw new Error('Unknown trusted fixture slot');
  return { workspace: 'growth-research', agent: slot };
}

export function createDurableMemoryStore(): PgvectorMemoryStore {
  let initialized: PgvectorMemoryStore | undefined;
  const store = () => {
    if (!initialized) {
      const connectionString = process.env['DAWN_DATABASE_URL'];
      if (!connectionString) throw new Error('DAWN_DATABASE_URL is required for durable Growth research memory');
      initialized = pgvectorMemoryStore({ connectionString, dimensions: syntheticEmbedder.dims, tablePrefix: 'growth_research' });
    }
    return initialized;
  };
  return {
    put: async (...args) => store().put(...args),
    get: async (...args) => store().get(...args),
    // Disabling Dawn's eager prompt index must not open a database at graph import.
    // Explicit recall uses a positive limit and still requires durable storage.
    search: async query => query.limit === 0 ? [] : store().search(query),
    update: async (...args) => store().update(...args),
    supersede: async (...args) => store().supersede(...args),
    delete: async (...args) => store().delete(...args),
    listCandidates: async (...args) => store().listCandidates(...args),
    browse: async (...args) => store().browse(...args),
    stats: async (...args) => store().stats(...args),
    prune: async (...args) => store().prune(...args),
    close: async () => { await initialized?.close(); initialized = undefined; },
  };
}

export const candidateMemoryStore = createDurableMemoryStore();
