import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPlatformClient, PlatformError, researchGraphId } from './platform-client.mts';

export const fixturePrompts = {
  direct: 'direct fixture atlas: do not delegate. Load company-evidence with readSkill, read atlas with readFixture, mark your plan completed with writeTodos, and report the fixture source.',
  delegated: 'delegate atlas: delegate exactly once to researcher with input "specialist atlas". Return its source citation.',
  continuation: 'continuation fixture atlas: use the prior thread evidence and state to report the Atlas fixture source again. Do not delegate.',
  memory: 'memory fixture atlas: read atlas with readFixture. Use remember with data {"fixtureId":"atlas","observation":"Synthetic Angular evaluation","source":"fixture:atlas:v1"} and content "Synthetic Angular evaluation". Then recall "Synthetic Angular evaluation". Report the pending candidate and do not approve it.',
} as const;
export type SmokeFixture = keyof typeof fixturePrompts;
export function isSmokeFixture(value: string): value is SmokeFixture {
  return Object.hasOwn(fixturePrompts, value);
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PlatformError('missing_evidence', 'Expected persisted fixture state.');
  return value as Record<string, unknown>;
}
function content(message: Record<string, unknown>): string {
  return typeof message['content'] === 'string' ? message['content'] : JSON.stringify(message['content'] ?? '');
}

export function verifyContinuationBase(state: unknown): void {
  const values = record(record(state)['values']);
  if (!Array.isArray(values['messages'])) throw new PlatformError('missing_evidence', 'Expected prior direct fixture state.');
  const messages = values['messages'].map(record);
  const start = messages.findLastIndex(message => ['human', 'user'].includes(String(message['type'] ?? message['role'])) && content(message).startsWith('direct fixture atlas'));
  if (start < 0) throw new PlatformError('missing_evidence', 'Expected prior direct fixture state.');
  const end = messages.findIndex((message, index) => index > start && ['human', 'user'].includes(String(message['type'] ?? message['role'])));
  verifyFixtureState('direct', { values: { ...values, messages: messages.slice(start, end < 0 ? undefined : end) } });
}

export function verifyFixtureState(fixture: SmokeFixture, state: unknown) {
  const values = record(record(state)['values']);
  if (!Array.isArray(values['messages'])) throw new PlatformError('missing_evidence', 'Expected persisted messages.');
  const messages = values['messages'].map(record);
  const fail = () => { throw new PlatformError('missing_evidence', `Persisted ${fixture} evidence did not meet the smoke gate.`); };
  const turnStart = messages.findLastIndex(message => ['human', 'user'].includes(String(message['type'] ?? message['role'])));
  const expectedStart = fixture === 'delegated' ? 'delegate atlas' : `${fixture} fixture atlas`;
  if (turnStart < 0 || !content(messages[turnStart] ?? {}).startsWith(expectedStart)) fail();
  const current = messages.slice(turnStart);
  const tools = current.filter(message => (message['type'] ?? message['role']) === 'tool');
  if (tools.some(tool => tool['status'] === 'error')) fail();
  const final = messages.at(-1);
  if (!final || !['ai', 'assistant'].includes(String(final['type'] ?? final['role'])) || !content(final)) fail();
  const hasTool = (name: string, text: string) => tools.some(tool => tool['name'] === name && content(tool).includes(text));
  const todos = Array.isArray(values['todos']) ? values['todos'].map(record) : [];
  const planComplete = todos.length > 0 && todos.every(todo => todo['status'] === 'completed');
  let candidateId: string | undefined;
  if (fixture === 'continuation') {
    verifyContinuationBase(state);
    if (!planComplete) fail();
  } else if (fixture === 'direct') {
    if (!hasTool('readSkill', 'Never treat candidate memory as an accepted account fact') || !hasTool('readFixture', 'fixture:atlas:v1') || !hasTool('writeTodos', '') || !planComplete) fail();
  } else if (fixture === 'delegated') {
    const taskCall = current.some(message => Array.isArray(message['tool_calls']) && message['tool_calls'].some(call => {
      const value = record(call); return value['name'] === 'task' && record(value['args'])['subagent'] === 'researcher';
    }));
    if (!taskCall || !hasTool('task', 'fixture:atlas:v1')) fail();
  } else if (fixture === 'memory') {
    const remembered = tools.find(tool => tool['name'] === 'remember' && /Stored memory candidate memory_[a-f0-9]{16} \(pending approval\)/.test(content(tool)));
    candidateId = remembered ? content(remembered).match(/memory_[a-f0-9]{16}/)?.[0] : undefined;
    const recalls = tools.filter(tool => tool['name'] === 'recall');
    if (!candidateId || !recalls.length || recalls.some(tool => content(tool).trim() !== '(no memories found)') || tools.indexOf(recalls[0] ?? {}) < tools.indexOf(remembered ?? {})) fail();
    const between = current.slice(current.indexOf(remembered ?? {}) + 1, current.indexOf(recalls[0] ?? {}));
    if (!between.some(message => ['ai', 'assistant'].includes(String(message['type'] ?? message['role'])) && Array.isArray(message['tool_calls']) && message['tool_calls'].some(call => record(call)['name'] === 'recall'))) fail();
  } else fail();
  return { fixture, tools: [...new Set(tools.map(tool => String(tool['name'])))], planComplete, messageCount: messages.length, ...(candidateId ? { candidateId } : {}) };
}

export async function runFixture(client: ReturnType<typeof createPlatformClient>, fixture: SmokeFixture, threadId: string, smokeId: string) {
  if (!isSmokeFixture(fixture)) throw new PlatformError('invalid_arguments', 'Unknown synthetic fixture.');
  const assistants = await client.discover();
  if (!Array.isArray(assistants) || !assistants.length || assistants.length >= 100 || assistants.some(row => record(row)['graph_id'] !== researchGraphId)) {
    throw new PlatformError('graph_discovery_failed', 'Expected only the coordinator graph on the research deployment.');
  }
  await client.ensureFixtureThread(threadId, smokeId);
  if (fixture === 'continuation') verifyContinuationBase(await client.getState(threadId));
  const correlation = `${smokeId}:${fixture}`;
  const run = await client.submitRun(threadId, correlation, { messages: [{ role: 'user', content: fixturePrompts[fixture] }] });
  try {
    await client.waitForSuccess(threadId, run.run_id);
    const state = await client.getState(threadId);
    return { ...verifyFixtureState(fixture, state), threadId, runId: run.run_id, smokeId, checkpoint: record(state)['checkpoint_id'] ?? record(state)['checkpoint'] ?? null };
  } catch (error) {
    // Preserve failed evidence, but stop a known active run before the operator inspects it.
    const current = await client.getRun(threadId, run.run_id).catch(() => null);
    if (current?.status === 'running' || current?.status === 'pending') await client.cancelRun(threadId, run.run_id);
    throw error;
  }
}

async function main(): Promise<void> {
  if (process.env['GROWTH_RESEARCH_FIXTURE_MODE'] !== 'synthetic-only') throw new PlatformError('fixture_disabled', 'Synthetic fixture mode must be explicitly enabled.');
  const [fixture, threadId, smokeId] = process.argv.slice(2);
  if (!fixture || !threadId || !smokeId || !(isSmokeFixture(fixture) || fixture === 'cleanup')) throw new PlatformError('invalid_arguments', 'Use: langsmith-smoke.mts direct|delegated|memory|continuation|cleanup THREAD_UUID SMOKE_ID');
  const client = createPlatformClient({ url: process.env['GROWTH_RESEARCH_URL'] ?? '', apiKey: process.env['LANGSMITH_API_KEY'] });
  if (fixture === 'cleanup') {
    await client.deleteFixtureThread(threadId, smokeId);
    console.log(JSON.stringify({ threadId, smokeId, deletedAndAbsent: true }));
  } else {
    console.log(JSON.stringify(await runFixture(client, fixture as SmokeFixture, threadId, smokeId)));
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(JSON.stringify({ error: error instanceof PlatformError ? error.code : 'smoke_failed', threadId: process.argv[3], smokeId: process.argv[4] }));
    process.exitCode = 1;
  });
}
