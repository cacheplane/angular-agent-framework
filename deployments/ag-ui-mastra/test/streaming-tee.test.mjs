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

/** Fake agent whose stream() yields two chunks and carries a sibling prop. */
function fakeAgent(trace = []) {
  return {
    getMemory() {},
    listTools() {},
    async stream() {
      return {
        fullStream: (async function* () {
          yield { type: 'a' };
          yield { type: 'b' };
        })(),
        text: 'x',
      };
    },
    async resumeStream() {
      return {
        fullStream: (async function* () {
          yield { type: 'r1' };
        })(),
        usage: 'u',
      };
    },
    _trace: trace,
  };
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

// ── Task 1: ordering, passthrough, resumeStream, `this`, observer errors ──
test('observer sees each chunk BEFORE the consumer receives it', async () => {
  const trace = [];
  const proxy = withDelegationTee(fakeAgent(), (c) => trace.push(`obs:${c.type}`));
  const result = await proxy.stream([], {});
  for await (const c of result.fullStream) trace.push(`out:${c.type}`);
  assert.deepEqual(trace, ['obs:a', 'out:a', 'obs:b', 'out:b']);
});

test('non-fullStream properties of the stream result are preserved', async () => {
  const proxy = withDelegationTee(fakeAgent(), () => {});
  const result = await proxy.stream([], {});
  assert.equal(result.text, 'x');
});

test('resumeStream is wrapped the same way', async () => {
  const trace = [];
  const proxy = withDelegationTee(fakeAgent(), (c) => trace.push(`obs:${c.type}`));
  const result = await proxy.resumeStream({}, {});
  assert.equal(result.usage, 'u');
  for await (const c of result.fullStream) trace.push(`out:${c.type}`);
  assert.deepEqual(trace, ['obs:r1', 'out:r1']);
});

test('stream/resumeStream receive the original arguments', async () => {
  const calls = [];
  const agent = {
    getMemory() {},
    async stream(...args) {
      calls.push(['stream', ...args]);
      return { fullStream: (async function* () {})() };
    },
    async resumeStream(...args) {
      calls.push(['resume', ...args]);
      return { fullStream: (async function* () {})() };
    },
  };
  const proxy = withDelegationTee(agent, () => {});
  await proxy.stream('msgs', { runId: 'r' });
  await proxy.resumeStream({ approved: true }, { runId: 'r2' });
  assert.deepEqual(calls, [
    ['stream', 'msgs', { runId: 'r' }],
    ['resume', { approved: true }, { runId: 'r2' }],
  ]);
});

test('other members forward with `this` bound to the real agent (#private fields work)', () => {
  class Probe extends Agent {
    #secret = 'hidden';
    readSecret() {
      return this.#secret;
    }
  }
  const agent = new Probe({ id: 'p', name: 'p', instructions: 'p', model: 'openai/gpt-4o-mini' });
  const proxy = withDelegationTee(agent, () => {});
  // Calling through the proxy must not throw "Cannot read private member".
  assert.equal(proxy.readSecret(), 'hidden');
  assert.equal(proxy.id, 'p');
  assert.equal(typeof proxy.getMemory, 'function');
});

test('a throwing observer does not break the consumer', async () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args);
  try {
    const proxy = withDelegationTee(fakeAgent(), (c) => {
      if (c.type === 'a') throw new Error('observer boom');
    });
    const result = await proxy.stream([], {});
    const seen = [];
    for await (const c of result.fullStream) seen.push(c.type);
    assert.deepEqual(seen, ['a', 'b']);
    assert.equal(warnings.length, 1);
    assert.match(String(warnings[0][0]), /observer/);
  } finally {
    console.warn = originalWarn;
  }
});

test('a stream result without fullStream is returned untouched', async () => {
  const agent = { getMemory() {}, async stream() { return { processDataStream() {} }; } };
  const proxy = withDelegationTee(agent, () => {});
  const result = await proxy.stream([], {});
  assert.equal(typeof result.processDataStream, 'function');
  assert.equal(result.fullStream, undefined);
});

// ── Consumer early-exit propagates to the source generator ────────────────
test('consumer breaking out of the wrapped fullStream closes the source generator', async () => {
  let finallyRan = false;
  async function* source() {
    try {
      yield { type: 'a' };
      yield { type: 'b' };
      yield { type: 'c' };
    } finally {
      finallyRan = true;
    }
  }
  const agent = {
    getMemory() {},
    async stream() {
      return { fullStream: source() };
    },
  };
  const proxy = withDelegationTee(agent, () => {});
  const result = await proxy.stream([], {});
  const seen = [];
  for await (const c of result.fullStream) {
    seen.push(c.type);
    if (c.type === 'a') break;
  }
  assert.deepEqual(seen, ['a']);
  assert.equal(finallyRan, true, "breaking the consumer's loop must call the source generator's return()");
});

// ── Result proxy forwards prototype getters, not just own properties ──────
test('traceId/usage defined as prototype getters still resolve through the result proxy', async () => {
  class StreamResult {
    get traceId() {
      return 'trace-123';
    }
    get usage() {
      return { total: 42 };
    }
  }
  const resultInstance = new StreamResult();
  resultInstance.fullStream = (async function* () {
    yield { type: 'a' };
  })();
  const agent = {
    getMemory() {},
    async stream() {
      return resultInstance;
    },
  };
  const proxy = withDelegationTee(agent, () => {});
  const result = await proxy.stream([], {});
  assert.equal(result.traceId, 'trace-123');
  assert.deepEqual(result.usage, { total: 42 });
});
