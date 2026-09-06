import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeNamespace } from '@dawn-ai/memory';
import { createAgentHarness, script } from '@dawn-ai/testing';
import { candidateMemoryStore as store, syntheticEmbedder, trustedFixtureScope } from '../src/runtime/memory-store.ts';

if (!process.env['GROWTH_RESEARCH_TEST_DATABASE_URL']) throw new Error('GROWTH_RESEARCH_TEST_DATABASE_URL is required');
if (process.env['DAWN_DATABASE_URL'] !== process.env['GROWTH_RESEARCH_TEST_DATABASE_URL']) throw new Error('Memory probe must use the explicit test database');
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixtureId = trustedFixtureScope().agent;
const namespace = serializeNamespace({ ...trustedFixtureScope(), route: '/enrichment/research' });
const action = process.argv[2];
let harness: Awaited<ReturnType<typeof createAgentHarness>> | undefined;
try {
  if (action === 'write') {
    const observation = `Synthetic candidate ${randomUUID()}`;
    harness = await createAgentHarness({ appRoot, route: '/enrichment/research#agent' });
    const run = await harness.run({ input: 'write synthetic candidate', fixtures: script().user('write synthetic candidate').callsTool('remember', {
      data: { fixtureId, observation, source: `fixture:${fixtureId}:v1` }, content: observation,
    }).replies('Candidate proposed.') });
    const candidate = (await store.listCandidates(namespace)).find(record => record.content === observation);
    if (!candidate || candidate.status !== 'candidate') throw new Error(`Expected candidate write: ${JSON.stringify(run.toolResults)}`);
    console.log(JSON.stringify({ id: candidate.id, pid: process.pid }));
  } else if (action === 'seed-active-control') {
    // Independent test control: never promote or alter the model-authored candidate.
    const id = `synthetic_control_${randomUUID()}`;
    const content = `Synthetic active control ${id}`;
    const now = new Date().toISOString();
    const [embedding] = await syntheticEmbedder.embed([content]);
    await store.put({
      id, namespace, kind: 'semantic', status: 'active', content,
      data: { fixtureId, observation: content, source: `fixture:${fixtureId}:v1` },
      source: { type: 'eval', id }, confidence: 1, tags: [id], createdAt: now, updatedAt: now,
    }, { embedding, embeddingModel: syntheticEmbedder.id });
    console.log(JSON.stringify({ id, content, pid: process.pid }));
  } else if (action === 'read') {
    harness = await createAgentHarness({ appRoot, route: '/enrichment/research#agent' });
    const controlId = process.argv[3];
    const run = await harness.run({ input: 'recall synthetic candidates', fixtures: script().user('recall synthetic candidates').callsTool('recall', { query: controlId ?? 'Synthetic candidate', ...(controlId ? { tags: [controlId] } : {}) }).replies('Recall checked.') });
    if (run.toolResults.some(result => result.isError)) throw new Error('Generated memory recall failed');
    console.log(JSON.stringify({ pid: process.pid, candidateIds: (await store.listCandidates(namespace)).map(record => record.id), activeIds: (await store.search({ namespace, status: 'active' })).map(record => record.id), recalled: JSON.stringify(run.toolResults) }));
  } else if (action === 'delete' && process.argv[3]) {
    const record = await store.get(process.argv[3]);
    if (record && record.namespace !== namespace) throw new Error('Cannot delete a record outside this fixture namespace');
    await store.delete(process.argv[3]);
    console.log(JSON.stringify({ pid: process.pid }));
  } else throw new Error('Unknown memory probe action');
} finally {
  await harness?.close();
  await store.close();
}
