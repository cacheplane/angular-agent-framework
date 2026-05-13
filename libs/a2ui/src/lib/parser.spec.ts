// SPDX-License-Identifier: MIT
import { describe, expect, test } from 'vitest';
import { createA2uiMessageParser } from './parser';

describe('createA2uiMessageParser (v1)', () => {
  test('parses surfaceUpdate envelope', () => {
    const parser = createA2uiMessageParser();
    const msgs = parser.push(JSON.stringify({
      surfaceUpdate: {
        surfaceId: 's1',
        components: [{ id: 'root', component: { Card: { child: 'inner' } } }],
      },
    }) + '\n');
    expect(msgs).toHaveLength(1);
    expect('surfaceUpdate' in msgs[0]).toBe(true);
  });

  test('parses dataModelUpdate envelope', () => {
    const parser = createA2uiMessageParser();
    const msgs = parser.push(JSON.stringify({
      dataModelUpdate: {
        surfaceId: 's1',
        contents: [{ key: 'name', valueString: 'Brian' }],
      },
    }) + '\n');
    expect(msgs).toHaveLength(1);
    expect('dataModelUpdate' in msgs[0]).toBe(true);
  });

  test('parses beginRendering envelope', () => {
    const parser = createA2uiMessageParser();
    const msgs = parser.push(JSON.stringify({
      beginRendering: { surfaceId: 's1', root: 'root' },
    }) + '\n');
    expect(msgs).toHaveLength(1);
    expect('beginRendering' in msgs[0]).toBe(true);
  });

  test('parses deleteSurface envelope', () => {
    const parser = createA2uiMessageParser();
    const msgs = parser.push(JSON.stringify({ deleteSurface: { surfaceId: 's1' } }) + '\n');
    expect(msgs).toHaveLength(1);
    expect('deleteSurface' in msgs[0]).toBe(true);
  });

  test('handles partial JSONL across pushes', () => {
    const parser = createA2uiMessageParser();
    const json = JSON.stringify({ beginRendering: { surfaceId: 's1', root: 'root' } });
    const half = Math.floor(json.length / 2);
    expect(parser.push(json.slice(0, half))).toEqual([]);
    const msgs = parser.push(json.slice(half) + '\n');
    expect(msgs).toHaveLength(1);
  });

  test('skips malformed lines silently', () => {
    const parser = createA2uiMessageParser();
    const msgs = parser.push('{not valid json}\n' + JSON.stringify({
      beginRendering: { surfaceId: 's1', root: 'root' },
    }) + '\n');
    expect(msgs).toHaveLength(1);
  });

  test('rejects unknown envelope keys', () => {
    const parser = createA2uiMessageParser();
    const msgs = parser.push(JSON.stringify({ unknownKey: { foo: 1 } }) + '\n');
    expect(msgs).toHaveLength(0);
  });

  test('parses multiple messages in one chunk', () => {
    const parser = createA2uiMessageParser();
    const chunk = [
      JSON.stringify({ surfaceUpdate: { surfaceId: 's1', components: [] } }),
      JSON.stringify({ dataModelUpdate: { surfaceId: 's1', contents: [] } }),
      JSON.stringify({ beginRendering: { surfaceId: 's1', root: 'root' } }),
    ].join('\n') + '\n';
    const msgs = parser.push(chunk);
    expect(msgs).toHaveLength(3);
  });
});

interface ParserRow {
  name: string;
  /** Sequence of chunks to push. */
  chunks: readonly string[];
  /** Expected envelope-key sequence across all push() calls combined. */
  expectedKeys: readonly string[];
}

const BR = (root: string) =>
  JSON.stringify({ beginRendering: { surfaceId: 's', root } });
const SU = () =>
  JSON.stringify({ surfaceUpdate: { surfaceId: 's', components: [] } });
const DM = (key: string) =>
  JSON.stringify({ dataModelUpdate: { surfaceId: 's', contents: [{ key, valueString: 'v' }] } });

const parserRows: ParserRow[] = [
  { name: 'envelope with CRLF', chunks: [BR('r') + '\r\n'], expectedKeys: ['beginRendering'] },
  { name: 'envelope split mid-key', chunks: ['{"begin', 'Rendering":{"surfaceId":"s","root":"r"}}\n'], expectedKeys: ['beginRendering'] },
  { name: 'envelope split mid-string-value', chunks: ['{"beginRendering":{"surfaceId":"s","root":"', 'r"}}\n'], expectedKeys: ['beginRendering'] },
  { name: 'three envelopes one chunk', chunks: [[SU(), DM('k'), BR('r')].join('\n') + '\n'], expectedKeys: ['surfaceUpdate', 'dataModelUpdate', 'beginRendering'] },
  {
    name: 'three envelopes char-by-char',
    chunks: ([SU(), DM('k'), BR('r')].join('\n') + '\n').split(''),
    expectedKeys: ['surfaceUpdate', 'dataModelUpdate', 'beginRendering'],
  },
  { name: 'malformed line then valid line', chunks: ['{garbage}\n' + BR('r') + '\n'], expectedKeys: ['beginRendering'] },
  { name: 'valid envelope no trailing newline waits', chunks: [BR('r')], expectedKeys: [] },
  { name: 'valid envelope, then trailing newline later', chunks: [BR('r'), '\n'], expectedKeys: ['beginRendering'] },
  { name: 'empty lines between envelopes', chunks: ['\n\n' + BR('r') + '\n\n' + BR('r2') + '\n'], expectedKeys: ['beginRendering', 'beginRendering'] },
  { name: 'whitespace before brace', chunks: ['   ' + BR('r') + '\n'], expectedKeys: ['beginRendering'] },
  { name: 'unrecognised envelope key', chunks: ['{"mysteryUpdate":{}}\n'], expectedKeys: [] },
  {
    name: 'mixed valid + unknown + valid',
    chunks: [[BR('r'), '{"mysteryUpdate":{}}', BR('r2')].join('\n') + '\n'],
    expectedKeys: ['beginRendering', 'beginRendering'],
  },
];

describe('createA2uiMessageParser — input variance', () => {
  test.each(parserRows)('$name', (row) => {
    const parser = createA2uiMessageParser();
    const keys: string[] = [];
    for (const chunk of row.chunks) {
      const msgs = parser.push(chunk);
      for (const m of msgs) keys.push(Object.keys(m)[0]);
    }
    expect(keys).toEqual(row.expectedKeys);
  });
});
