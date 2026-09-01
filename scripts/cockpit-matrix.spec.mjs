import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isCapAffected, selectCockpitCaps } from './cockpit-matrix.mjs';

const ALL_CAPS = [
  {
    angular: 'cockpit-chat-messages-angular',
    python: 'cockpit/chat/messages/python',
    pythonName: 'cockpit-chat-messages-python',
  },
  {
    angular: 'cockpit-chat-input-angular',
    python: 'cockpit/chat/input/python',
    pythonName: 'cockpit-chat-input-python',
  },
  {
    angular: 'cockpit-langgraph-streaming-angular',
    python: 'cockpit/langgraph/streaming/python',
    pythonName: 'cockpit-langgraph-streaming-python',
  },
  // Node-hosted backend: no python sibling on disk.
  { angular: 'cockpit-runtimes-mastra-angular', python: '', pythonName: '' },
];

describe('selectCockpitCaps', () => {
  test('returns only affected caps when fullFleet=false', () => {
    const result = selectCockpitCaps(
      ALL_CAPS,
      new Set(['cockpit-chat-messages-angular']),
      { fullFleet: false },
    );
    assert.deepEqual(result, [ALL_CAPS[0]]);
  });

  test('returns multiple affected caps preserving input order', () => {
    const result = selectCockpitCaps(
      ALL_CAPS,
      new Set(['cockpit-langgraph-streaming-angular', 'cockpit-chat-messages-angular']),
      { fullFleet: false },
    );
    assert.deepEqual(result, [ALL_CAPS[0], ALL_CAPS[2]]);
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

describe('selectCockpitCaps — python sibling attribution', () => {
  // A cap's python project is a separate nx project from its Angular app, and
  // the two are not linked in the project graph. Matching only on `cap.angular`
  // meant a python-only cap change produced an empty selection, which
  // cockpit-matrix's main() reads as "nx attributed nothing" and answers with
  // the full fleet — ~40 lanes to cover a one-cap change.
  test('selects the cap when only its python project is affected', () => {
    const result = selectCockpitCaps(
      ALL_CAPS,
      new Set(['cockpit-chat-messages-python']),
      { fullFleet: false },
    );
    assert.deepEqual(result, [ALL_CAPS[0]]);
  });

  test('does not double-select when both siblings are affected', () => {
    const result = selectCockpitCaps(
      ALL_CAPS,
      new Set(['cockpit-chat-messages-python', 'cockpit-chat-messages-angular']),
      { fullFleet: false },
    );
    assert.deepEqual(result, [ALL_CAPS[0]]);
  });

  test('mixes angular- and python-attributed caps', () => {
    const result = selectCockpitCaps(
      ALL_CAPS,
      new Set(['cockpit-langgraph-streaming-python', 'cockpit-chat-input-angular']),
      { fullFleet: false },
    );
    assert.deepEqual(result, [ALL_CAPS[1], ALL_CAPS[2]]);
  });
});

describe('isCapAffected', () => {
  test('matches on the angular project name', () => {
    assert.equal(
      isCapAffected(ALL_CAPS[0], new Set(['cockpit-chat-messages-angular'])),
      true,
    );
  });

  test('matches on the python project name', () => {
    assert.equal(
      isCapAffected(ALL_CAPS[0], new Set(['cockpit-chat-messages-python'])),
      true,
    );
  });

  test('an empty pythonName never matches an empty-string entry', () => {
    // cockpit-runtimes-mastra has no python sibling; a falsy pythonName must
    // not turn `affectedNames.has('')` into a match.
    assert.equal(isCapAffected(ALL_CAPS[3], new Set([''])), false);
  });

  test('unrelated affected names do not match', () => {
    assert.equal(isCapAffected(ALL_CAPS[0], new Set(['chat', 'website'])), false);
  });
});
