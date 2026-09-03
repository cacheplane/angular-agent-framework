import { describe, expect, test } from 'vitest';
import { createA2uiMessageParser } from './parser';

describe('createA2uiMessageParser (v0.9)', () => {
  test('parses createSurface envelope and preserves version', () => {
    const parser = createA2uiMessageParser();
    const msgs = parser.push(JSON.stringify({
      version: 'v0.9',
      createSurface: { surfaceId: 's1', catalogId: 'basic' },
    }) + '\n');
    expect(msgs).toHaveLength(1);
    expect('createSurface' in msgs[0]).toBe(true);
    expect(msgs[0].version).toBe('v0.9');
  });

  test('parses updateComponents envelope', () => {
    const parser = createA2uiMessageParser();
    const msgs = parser.push(JSON.stringify({
      version: 'v0.9',
      updateComponents: {
        surfaceId: 's1',
        components: [{ id: 'root', component: 'Card', child: 'inner' }],
      },
    }) + '\n');
    expect(msgs).toHaveLength(1);
    expect('updateComponents' in msgs[0]).toBe(true);
  });

  test('parses updateDataModel envelope (value optional)', () => {
    const parser = createA2uiMessageParser();
    const msgs = parser.push(
      JSON.stringify({ version: 'v0.9', updateDataModel: { surfaceId: 's1', path: '/name', value: 'Brian' } }) + '\n'
      + JSON.stringify({ version: 'v0.9', updateDataModel: { surfaceId: 's1', path: '/stale' } }) + '\n',
    );
    expect(msgs).toHaveLength(2);
    expect('updateDataModel' in msgs[0]).toBe(true);
    expect('updateDataModel' in msgs[1]).toBe(true);
  });

  test('parses deleteSurface envelope', () => {
    const parser = createA2uiMessageParser();
    const msgs = parser.push(JSON.stringify({ version: 'v0.9', deleteSurface: { surfaceId: 's1' } }) + '\n');
    expect(msgs).toHaveLength(1);
    expect('deleteSurface' in msgs[0]).toBe(true);
  });

  test('defaults missing version to v0.9', () => {
    const parser = createA2uiMessageParser();
    const msgs = parser.push(JSON.stringify({ deleteSurface: { surfaceId: 's1' } }) + '\n');
    expect(msgs).toHaveLength(1);
    expect(msgs[0].version).toBe('v0.9');
  });

  test('handles partial JSONL across pushes', () => {
    const parser = createA2uiMessageParser();
    const json = JSON.stringify({ version: 'v0.9', createSurface: { surfaceId: 's1', catalogId: 'basic' } });
    const half = Math.floor(json.length / 2);
    expect(parser.push(json.slice(0, half))).toEqual([]);
    const msgs = parser.push(json.slice(half) + '\n');
    expect(msgs).toHaveLength(1);
  });

  test('skips malformed lines silently', () => {
    const parser = createA2uiMessageParser();
    const msgs = parser.push('{not valid json}\n' + JSON.stringify({
      version: 'v0.9', createSurface: { surfaceId: 's1', catalogId: 'basic' },
    }) + '\n');
    expect(msgs).toHaveLength(1);
  });

  test('skips unknown envelope keys (v1.0 forward-compat)', () => {
    const parser = createA2uiMessageParser();
    const msgs = parser.push(
      JSON.stringify({ version: 'v1.0', callRendererFunction: { call: 'x', functionCallId: '1' } }) + '\n'
      + JSON.stringify({ unknownKey: { foo: 1 } }) + '\n',
    );
    expect(msgs).toHaveLength(0);
  });

  test('parses multiple messages in one chunk', () => {
    const parser = createA2uiMessageParser();
    const chunk = [
      JSON.stringify({ version: 'v0.9', createSurface: { surfaceId: 's1', catalogId: 'basic' } }),
      JSON.stringify({ version: 'v0.9', updateComponents: { surfaceId: 's1', components: [] } }),
      JSON.stringify({ version: 'v0.9', updateDataModel: { surfaceId: 's1', value: {} } }),
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

const CS = (id: string) =>
  JSON.stringify({ version: 'v0.9', createSurface: { surfaceId: id, catalogId: 'basic' } });
const UC = () =>
  JSON.stringify({ version: 'v0.9', updateComponents: { surfaceId: 's', components: [] } });
const DM = (key: string) =>
  JSON.stringify({ version: 'v0.9', updateDataModel: { surfaceId: 's', path: `/${key}`, value: 'v' } });

const envelopeKeyOf = (m: object): string =>
  Object.keys(m).find((k) => k !== 'version') ?? 'version';

const parserRows: ParserRow[] = [
  { name: 'envelope with CRLF', chunks: [CS('s') + '\r\n'], expectedKeys: ['createSurface'] },
  { name: 'envelope split mid-key', chunks: ['{"version":"v0.9","create', 'Surface":{"surfaceId":"s","catalogId":"basic"}}\n'], expectedKeys: ['createSurface'] },
  { name: 'envelope split mid-string-value', chunks: ['{"version":"v0.9","createSurface":{"surfaceId":"', 's","catalogId":"basic"}}\n'], expectedKeys: ['createSurface'] },
  { name: 'three envelopes one chunk', chunks: [[CS('s'), UC(), DM('k')].join('\n') + '\n'], expectedKeys: ['createSurface', 'updateComponents', 'updateDataModel'] },
  {
    name: 'three envelopes char-by-char',
    chunks: ([CS('s'), UC(), DM('k')].join('\n') + '\n').split(''),
    expectedKeys: ['createSurface', 'updateComponents', 'updateDataModel'],
  },
  { name: 'malformed line then valid line', chunks: ['{garbage}\n' + CS('s') + '\n'], expectedKeys: ['createSurface'] },
  { name: 'valid envelope no trailing newline waits', chunks: [CS('s')], expectedKeys: [] },
  { name: 'valid envelope, then trailing newline later', chunks: [CS('s'), '\n'], expectedKeys: ['createSurface'] },
  { name: 'empty lines between envelopes', chunks: ['\n\n' + CS('s') + '\n\n' + CS('s2') + '\n'], expectedKeys: ['createSurface', 'createSurface'] },
  { name: 'whitespace before brace', chunks: ['   ' + CS('s') + '\n'], expectedKeys: ['createSurface'] },
  { name: 'unrecognised envelope key', chunks: ['{"mysteryUpdate":{}}\n'], expectedKeys: [] },
  {
    name: 'mixed valid + unknown + valid',
    chunks: [[CS('s'), '{"mysteryUpdate":{}}', CS('s2')].join('\n') + '\n'],
    expectedKeys: ['createSurface', 'createSurface'],
  },
];

describe('createA2uiMessageParser — input variance', () => {
  test.each(parserRows)('$name', (row) => {
    const parser = createA2uiMessageParser();
    const keys: string[] = [];
    for (const chunk of row.chunks) {
      const msgs = parser.push(chunk);
      for (const m of msgs) keys.push(envelopeKeyOf(m));
    }
    expect(keys).toEqual(row.expectedKeys);
  });
});
