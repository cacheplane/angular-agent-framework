import type { DawnConfig } from '@dawn-ai/core';
import './src/runtime/model-boundary.js';
import { candidateMemoryStore, syntheticEmbedder, trustedFixtureScope } from './src/runtime/memory-store.js';

export default {
  appDir: 'src/app',
  build: { targets: ['langsmith'] },
  toolOutput: { noOffloadTools: ['readFixture', 'coordinatorSummary', 'readSkill', 'writeTodos', 'recall', 'remember', 'readEvidence', 'submitCandidate'] },
  summarization: { enabled: false },
  memory: {
    store: candidateMemoryStore,
    indexMaxEntries: 0,
    writes: 'candidate',
    vector: { embedder: syntheticEmbedder },
    resolveScope: trustedFixtureScope,
    episodes: { enabled: false },
  },
} satisfies DawnConfig;
