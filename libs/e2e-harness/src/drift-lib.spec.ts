// SPDX-License-Identifier: MIT
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { summarizeEntry, diffFixtures, type FixtureEntry } from './drift-lib';

const text = (msg: string, content: string): FixtureEntry => ({
  match: { userMessage: msg },
  response: { content },
});
const tool = (msg: string, names: string[]): FixtureEntry => ({
  match: { userMessage: msg },
  response: { toolCalls: names.map((name) => ({ name, arguments: {} })) },
});

test('summarizeEntry: text response', () => {
  const s = summarizeEntry(text('hi', 'hello there'));
  assert.equal(s.kind, 'text');
  assert.deepEqual(s.toolNames, []);
  assert.equal(typeof s.lengthBucket, 'number');
});

test('summarizeEntry: toolCalls response', () => {
  const s = summarizeEntry(tool('plan', ['research', 'book']));
  assert.equal(s.kind, 'toolCalls');
  assert.deepEqual(s.toolNames, ['book', 'research']); // sorted
});

test('diffFixtures: identical pair reports no differences', () => {
  const d = diffFixtures([text('hi', 'hello')], [text('hi', 'hello world')]);
  assert.equal(d.changed.length, 0); // same kind, same tools, same bucket
});

test('diffFixtures: tool set change is reported', () => {
  const d = diffFixtures([tool('plan', ['research'])], [tool('plan', ['book'])]);
  assert.equal(d.changed.length, 1);
  assert.match(d.changed[0].reason, /toolNames/);
});

test('diffFixtures: kind change is reported', () => {
  const d = diffFixtures([tool('plan', ['research'])], [text('plan', 'sure!')]);
  assert.equal(d.changed.length, 1);
  assert.match(d.changed[0].reason, /kind/);
});

test('diffFixtures: incomplete recording is reported separately, not as drift', () => {
  // The aimock recorder emits { content: "" } when it cannot parse tool-call
  // deltas from a stream; that is a recorder artifact, not model drift.
  const d = diffFixtures([tool('plan', ['research'])], [text('plan', '')]);
  assert.equal(d.changed.length, 0);
  assert.deepEqual(d.incompleteRecordings, ['plan||']);
});

test('diffFixtures: unpairable entries are listed, not errored', () => {
  const d = diffFixtures([text('only-committed', 'x')], [text('only-recorded', 'y')]);
  assert.deepEqual(d.unmatchedCommitted, ['only-committed||']);
  assert.deepEqual(d.unmatchedRecorded, ['only-recorded||']);
});
