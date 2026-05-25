import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { selectCockpitCaps } from './cockpit-matrix.mjs';

const ALL_CAPS = [
  { angular: 'cockpit-chat-messages-angular', python: 'cockpit/chat/messages/python' },
  { angular: 'cockpit-chat-input-angular',    python: 'cockpit/chat/input/python' },
  { angular: 'cockpit-langgraph-streaming-angular', python: 'cockpit/langgraph/streaming/python' },
];

describe('selectCockpitCaps', () => {
  test('returns only affected caps when fullFleet=false', () => {
    const result = selectCockpitCaps(
      ALL_CAPS,
      new Set(['cockpit-chat-messages-angular']),
      { fullFleet: false },
    );
    assert.deepEqual(result, [
      { angular: 'cockpit-chat-messages-angular', python: 'cockpit/chat/messages/python' },
    ]);
  });

  test('returns multiple affected caps preserving input order', () => {
    const result = selectCockpitCaps(
      ALL_CAPS,
      new Set(['cockpit-langgraph-streaming-angular', 'cockpit-chat-messages-angular']),
      { fullFleet: false },
    );
    assert.deepEqual(result, [
      { angular: 'cockpit-chat-messages-angular', python: 'cockpit/chat/messages/python' },
      { angular: 'cockpit-langgraph-streaming-angular', python: 'cockpit/langgraph/streaming/python' },
    ]);
  });

  test('returns all caps when fullFleet=true regardless of affected', () => {
    const result = selectCockpitCaps(ALL_CAPS, new Set(), { fullFleet: true });
    assert.deepEqual(result, ALL_CAPS);
  });

  test('returns all caps when fullFleet=true even with subset affected', () => {
    const result = selectCockpitCaps(
      ALL_CAPS,
      new Set(['cockpit-chat-input-angular']),
      { fullFleet: true },
    );
    assert.deepEqual(result, ALL_CAPS);
  });

  test('returns empty array when fullFleet=false and no affected caps', () => {
    const result = selectCockpitCaps(ALL_CAPS, new Set(), { fullFleet: false });
    assert.deepEqual(result, []);
  });

  test('ignores non-cockpit affected entries (no false matches)', () => {
    const result = selectCockpitCaps(
      ALL_CAPS,
      new Set(['chat', 'langgraph', 'examples-chat-angular']),
      { fullFleet: false },
    );
    assert.deepEqual(result, []);
  });

  test('output round-trips through JSON.stringify/parse', () => {
    const result = selectCockpitCaps(
      ALL_CAPS,
      new Set(['cockpit-chat-input-angular']),
      { fullFleet: false },
    );
    assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
  });
});
