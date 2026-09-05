import { describe, expect, it } from 'vitest';
import { isSmokeFixture, verifyContinuationBase, verifyFixtureState } from '../scripts/langsmith-smoke.mts';

const tool = (name: string, content: string) => ({ type: 'tool', name, content });
const direct = { values: { messages: [
  { type: 'human', content: 'direct fixture atlas' },
  tool('readSkill', 'Never treat candidate memory as an accepted account fact'),
  tool('readFixture', '{"name":"Atlas Synthetic","source":"fixture:atlas:v1"}'),
  tool('writeTodos', '{}'), { type: 'ai', content: 'Done.' },
], todos: [{ content: 'Verify evidence', status: 'completed' }] } };

describe('deployed fixture evidence', () => {
  it('requires executed tools and persisted plan state for a direct result', () => {
    expect(verifyFixtureState('direct', direct)).toMatchObject({ fixture: 'direct', tools: ['readSkill', 'readFixture', 'writeTodos'], planComplete: true });
  });
  it('rejects persuasive final prose without evidence', () => {
    expect(() => verifyFixtureState('direct', { values: { messages: [{ type: 'ai', content: 'I loaded the skill and verified fixture:atlas:v1' }] } })).toThrow();
  });
  it('rejects a failed tool result despite the final answer', () => {
    const state = structuredClone(direct);
    Object.assign(state.values.messages[2] ?? {}, { status: 'error' });
    expect(() => verifyFixtureState('direct', state)).toThrow();
  });
  it('requires completed persisted todos', () => {
    const state = structuredClone(direct); state.values.todos = [{ content: 'Verify evidence', status: 'pending' }];
    expect(() => verifyFixtureState('direct', state)).toThrow();
  });
  it('requires a real task call to the registered specialist and its returned citation', () => {
    const taskArgs = { subagent: 'researcher' };
    const state = { values: { messages: [
      { type: 'human', content: 'delegate atlas' },
      { type: 'ai', tool_calls: [{ name: 'task', args: taskArgs }] },
      tool('task', 'Atlas specialist evidence [fixture:atlas:v1]'), { type: 'ai', content: 'Done.' },
    ] } };
    expect(verifyFixtureState('delegated', state)).toMatchObject({ fixture: 'delegated', tools: ['task'] });
    taskArgs.subagent = 'undeclared';
    expect(() => verifyFixtureState('delegated', state)).toThrow();
  });
  it('recognizes a pending memory candidate without treating it as accepted recall', () => {
    const state = { values: { messages: [{ type: 'human', content: 'memory fixture atlas' }, tool('remember', 'Stored memory candidate memory_0123456789abcdef (pending approval).'), { type: 'ai', tool_calls: [{ name: 'recall', args: { query: 'Synthetic Angular evaluation' } }] }, tool('recall', '(no memories found)'), { type: 'ai', content: 'Candidate proposed.' }] } };
    expect(verifyFixtureState('memory', state)).toMatchObject({ candidateId: 'memory_0123456789abcdef' });
  });
  it('rejects recall in the same parallel model tool round as remember', () => {
    const state = { values: { messages: [{ type: 'human', content: 'memory fixture atlas' }, { type: 'ai', tool_calls: [{ name: 'remember' }, { name: 'recall' }] }, tool('remember', 'Stored memory candidate memory_0123456789abcdef (pending approval).'), tool('recall', '(no memories found)'), { type: 'ai', content: 'Done.' }] } };
    expect(() => verifyFixtureState('memory', state)).toThrow();
  });
  it('rejects stale evidence and contradictory recall within the current memory turn', () => {
    const prior = [{ type: 'human', content: 'memory fixture atlas' }, tool('remember', 'Stored memory candidate memory_0123456789abcdef (pending approval).'), tool('recall', '(no memories found)'), { type: 'ai', content: 'Done.' }];
    const current = [{ type: 'human', content: 'memory fixture atlas' }, tool('remember', 'Stored memory candidate memory_1111111111111111 (pending approval).'), tool('recall', 'Candidate leaked as accepted fact'), { type: 'ai', content: 'Done.' }];
    expect(() => verifyFixtureState('memory', { values: { messages: [...prior, ...current] } })).toThrow();
    current.splice(2, 0, tool('recall', '(no memories found)'));
    expect(() => verifyFixtureState('memory', { values: { messages: current } })).toThrow();
  });
  it('accepts only own fixture names', () => {
    expect(isSmokeFixture('direct')).toBe(true);
    for (const value of ['constructor', 'toString', '__proto__', 'unknown']) expect(isSmokeFixture(value)).toBe(false);
  });
  it('requires prior evidence and a new continuation message on the same thread', () => {
    expect(() => verifyFixtureState('continuation', direct)).toThrow();
    const state = structuredClone(direct);
    state.values.messages.push({ type: 'human', content: 'continuation fixture atlas' }, { type: 'ai', content: 'Prior fixture evidence retained.' });
    expect(verifyFixtureState('continuation', state)).toMatchObject({ fixture: 'continuation', planComplete: true });
    expect(() => verifyContinuationBase(state)).not.toThrow();
  });
});
