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
