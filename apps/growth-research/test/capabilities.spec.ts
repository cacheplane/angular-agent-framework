import { cp, mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAgentHarness, createAimock, script, type AgentHarness, type Aimock } from '@dawn-ai/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let harness: AgentHarness | undefined;
let mock: Aimock;
let temporaryRoot: string | undefined;

beforeEach(async () => {
  vi.stubEnv('GROWTH_RESEARCH_FIXTURE_MODE', 'synthetic-only');
  vi.stubEnv('GROWTH_RESEARCH_FIXTURE_DELAY_MS', '0');
  vi.stubEnv('OPENAI_API_KEY', 'synthetic-test-key');
  mock = await createAimock({ fixtures: [] });
});
afterEach(async () => {
  await harness?.close(); harness = undefined;
  await mock.close();
  if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true });
  temporaryRoot = undefined;
  vi.unstubAllEnvs();
});

async function start(root = appRoot) {
  harness = await createAgentHarness({ appRoot: root, route: '/enrichment/research#agent', record: true, recordUpstream: mock.baseUrl.replace(/\/v1$/, '') });
  return harness;
}

describe('synthetic capability boundary', () => {
  it('executes direct fixture research with authored planning and loaded skill instructions', async () => {
    mock.addFixtures(script().user('direct fixture atlas')
      .callsTool('readSkill', { name: 'company-evidence' })
      .callsTool('readFixture', { fixtureId: 'atlas' })
      .callsTool('writeTodos', { todos: [{ content: 'Verify synthetic fixture evidence', status: 'completed' }] })
      .replies('Atlas synthetic evidence reviewed.').build());
    const run = await (await start()).run({ input: 'direct fixture atlas' });
    expect(run.toolResults.find(tool => tool.name === 'readFixture')?.content).toContain('Atlas Synthetic');
    expect(run.toolResults.find(tool => tool.name === 'readSkill')?.content).toContain('Never treat candidate memory as an accepted account fact');
    expect(run.systemPrompt).toContain('Identify the synthetic fixture');
    expect(run.planUpdates.at(-1)?.todos).toEqual([{ content: 'Verify synthetic fixture evidence', status: 'completed' }]);
    expect(run.finalMessage).toBe('Atlas synthetic evidence reviewed.');
    const requests = mock.getRequests();
    expect(requests).toHaveLength(4);
    const names = requests[0]?.body?.tools?.map(tool => tool.function?.name);
    expect(names?.sort()).toEqual(['coordinatorSummary', 'readFixture', 'readSkill', 'recall', 'remember', 'task', 'writeTodos']);
    for (const request of requests) expect(request.body).toMatchObject({ model: 'gpt-4.1-mini', max_tokens: 1024 });
  }, 60_000);

  it('rejects arbitrary fixture identifiers through the generated tool schema', async () => {
    mock.addFixtures(script().user('invalid fixture').callsTool('readFixture', { fixtureId: 'https://external.example/real-subject' }).replies('Invalid fixture denied.').build());
    const run = await (await start()).run({ input: 'invalid fixture' });
    expect(JSON.stringify(run.toolResults)).toMatch(/invalid|schema|expected/i);
    expect(JSON.stringify(run.toolResults)).not.toContain('Atlas Synthetic');
    expect(mock.getRequests()).toHaveLength(2);
  }, 60_000);

  it('delegates only to the registered specialist with scoped fixture tools', async () => {
    mock.addFixtures([
      ...script().user('delegate atlas')
        .callsTool('task', { subagent: 'researcher', input: 'specialist atlas' })
        .replies('Delegation complete.').build(),
      ...script().user('specialist atlas')
        .callsTool('readFixture', { fixtureId: 'atlas' })
        .replies('Atlas specialist evidence.').build(),
    ]);
    const run = await (await start()).run({ input: 'delegate atlas' });
    expect(run.subagents).toHaveLength(1);
    expect(run.subagents[0]).toMatchObject({ name: 'researcher', finalMessage: 'Atlas specialist evidence.' });
    expect(run.subagents[0]?.toolCalls).toContainEqual({ name: 'readFixture', args: { fixtureId: 'atlas' } });
    const child = mock.getRequests().find(request => JSON.stringify(request.body?.messages).includes('You are the synthetic evidence specialist'));
    expect(child).toBeDefined();
    expect(child?.body?.tools?.map(tool => tool.function?.name)).toEqual(['readFixture']);
  }, 60_000);

  it('rejects a specialist attempt to call its coordinator-only tool', async () => {
    mock.addFixtures([
      ...script().user('attempt parent tool').callsTool('task', { subagent: 'researcher', input: 'specialist attack' }).replies('Denied.').build(),
      ...script().user('specialist attack').callsTool('coordinatorSummary', { fixtureId: 'atlas' }).replies('No coordinator access.').build(),
    ]);
    const run = await (await start()).run({ input: 'attempt parent tool' });
    const childRequests = mock.getRequests().filter(request => JSON.stringify(request.body?.messages).includes('You are the synthetic evidence specialist'));
    expect(childRequests).toHaveLength(2);
    expect(JSON.stringify(childRequests[1]?.body?.messages)).toMatch(/not found|not available|unknown tool/i);
    expect(JSON.stringify(childRequests[1]?.body?.messages)).not.toContain('coordinator-only synthetic summary');
    expect(run.subagents[0]?.finalMessage).toBe('No coordinator access.');
  }, 60_000);

  it('denies an undeclared convention sibling at the dispatch boundary', async () => {
    temporaryRoot = await mkdtemp(join(tmpdir(), 'growth-capabilities-'));
    await cp(join(appRoot, 'src'), join(temporaryRoot, 'src'), { recursive: true });
    await cp(join(appRoot, 'dawn.config.ts'), join(temporaryRoot, 'dawn.config.ts'));
    await cp(join(appRoot, 'package.json'), join(temporaryRoot, 'package.json'));
    await symlink(join(appRoot, 'node_modules'), join(temporaryRoot, 'node_modules'));
    const sibling = join(temporaryRoot, 'src/app/enrichment/research/subagents/undeclared');
    await mkdir(sibling, { recursive: true });
    await writeFile(join(sibling, 'index.ts'), 'import {agent} from "@dawn-ai/sdk"; export default agent({model:"gpt-4.1-mini",systemPrompt:"UNDECLARED_SIBLING_EXECUTED",description:"Forbidden sibling"});');
    mock.addFixtures(script().user('try sibling').callsTool('task', { subagent: 'undeclared', input: 'forbidden child' }).replies('Sibling denied.').build());
    const run = await (await start(temporaryRoot)).run({ input: 'try sibling' });
    expect(run.subagents).toHaveLength(0);
    expect(JSON.stringify(run.toolResults)).toMatch(/DAWN_E3002|DAWN_E5003|invalid|expected/i);
    expect(run.systemPrompt).not.toContain('Forbidden sibling');
    expect(mock.getRequests()).toHaveLength(2);
  }, 60_000);

  it('blocks model invocation when fixture mode is absent, including a cached model', async () => {
    mock.addFixtures(script().user('gate warmup').replies('Warm.').build());
    const h = await start();
    await h.run({ input: 'gate warmup' });
    const count = mock.getRequests().length;
    delete process.env['GROWTH_RESEARCH_FIXTURE_MODE'];
    h.reset();
    const error = await h.run({ input: 'gate blocked' }).then(() => undefined, (failure: Error) => failure);
    expect(error).toBeInstanceOf(Error);
    // LangChain's bound completion client wraps fetch failures; retain the gate cause.
    expect(error?.cause instanceof Error ? error.cause.message : error?.message).toMatch(/fixture mode/i);
    expect(mock.getRequests()).toHaveLength(count);
  }, 60_000);
});
