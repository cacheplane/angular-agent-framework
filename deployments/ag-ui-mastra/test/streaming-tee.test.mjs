// SPDX-License-Identifier: MIT
// Unit tests for the delegation stream tee — a Proxy over a Mastra Agent
// that lets an observer see every `fullStream` chunk BEFORE the @ag-ui/mastra
// bridge consumes it, while every other member forwards to the real agent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Agent } from '@mastra/core/agent';
import { withDelegationTee } from '../streaming-tee.mjs';

/** A real Agent (no model call is ever made) so `#private` fields exist. */
function realAgent() {
  return new Agent({
    id: 'tee-probe',
    name: 'tee-probe',
    instructions: 'probe',
    model: 'openai/gpt-4o-mini',
  });
}

// ── Task 0 feasibility: the bridge's agent contract survives the Proxy ────
test('proxy over a real Agent still satisfies the bridge contract', async () => {
  const agent = realAgent();
  // Stub stream() on the instance: the bridge awaits it and reads fullStream.
  agent.stream = async () => ({
    fullStream: (async function* () {
      yield { type: 'start', payload: { messageId: 'm1' } };
    })(),
    text: Promise.resolve('x'),
  });

  const proxy = withDelegationTee(agent, () => {});

  assert.ok('getMemory' in proxy, "bridge's isLocalMastraAgent check: 'getMemory' in agent");
  assert.equal(typeof proxy.listTools, 'function');
  assert.equal(typeof proxy.getMemory, 'function');
  assert.equal(typeof proxy.resumeStream, 'function');
  assert.equal(proxy.model, agent.model, 'model property forwards');

  const result = await proxy.stream([], {});
  assert.ok(result && typeof result === 'object');
  assert.equal(typeof result.fullStream[Symbol.asyncIterator], 'function', 'fullStream is async-iterable');
  const seen = [];
  for await (const c of result.fullStream) seen.push(c.type);
  assert.deepEqual(seen, ['start']);
});
