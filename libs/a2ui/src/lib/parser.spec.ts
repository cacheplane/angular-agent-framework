// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { createA2uiMessageParser } from './parser';

describe('createA2uiMessageParser', () => {
  it('parses a createSurface message', () => {
    const parser = createA2uiMessageParser();
    const msgs = parser.push('{"version":"v0.9","createSurface":{"surfaceId":"s1","catalogId":"basic"}}\n');
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toEqual({
      type: 'createSurface',
      surfaceId: 's1',
      catalogId: 'basic',
    });
  });

  it('parses an updateComponents message', () => {
    const parser = createA2uiMessageParser();
    const msgs = parser.push('{"version":"v0.9","updateComponents":{"surfaceId":"s1","components":[{"id":"root","component":"Column","children":["c1"]}]}}\n');
    expect(msgs).toHaveLength(1);
    expect(msgs[0].type).toBe('updateComponents');
    expect((msgs[0] as any).components[0].id).toBe('root');
  });

  it('parses an updateDataModel message', () => {
    const parser = createA2uiMessageParser();
    const msgs = parser.push('{"version":"v0.9","updateDataModel":{"surfaceId":"s1","path":"/user/name","value":"Alice"}}\n');
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toEqual({
      type: 'updateDataModel',
      surfaceId: 's1',
      path: '/user/name',
      value: 'Alice',
    });
  });

  it('parses a deleteSurface message', () => {
    const parser = createA2uiMessageParser();
    const msgs = parser.push('{"version":"v0.9","deleteSurface":{"surfaceId":"s1"}}\n');
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toEqual({ type: 'deleteSurface', surfaceId: 's1' });
  });

  it('parses multiple messages in one chunk', () => {
    const parser = createA2uiMessageParser();
    const msgs = parser.push(
      '{"version":"v0.9","createSurface":{"surfaceId":"s1","catalogId":"basic"}}\n' +
      '{"version":"v0.9","updateComponents":{"surfaceId":"s1","components":[]}}\n'
    );
    expect(msgs).toHaveLength(2);
    expect(msgs[0].type).toBe('createSurface');
    expect(msgs[1].type).toBe('updateComponents');
  });

  it('buffers incomplete lines across pushes', () => {
    const parser = createA2uiMessageParser();
    const msgs1 = parser.push('{"version":"v0.9","createSurface":{"surfaceI');
    expect(msgs1).toHaveLength(0);

    const msgs2 = parser.push('d":"s1","catalogId":"basic"}}\n');
    expect(msgs2).toHaveLength(1);
    expect(msgs2[0].type).toBe('createSurface');
  });

  it('ignores empty lines', () => {
    const parser = createA2uiMessageParser();
    const msgs = parser.push('\n\n{"version":"v0.9","deleteSurface":{"surfaceId":"s1"}}\n\n');
    expect(msgs).toHaveLength(1);
  });

  it('skips unrecognized envelope keys', () => {
    const parser = createA2uiMessageParser();
    const msgs = parser.push('{"version":"v0.9","unknownType":{"foo":"bar"}}\n');
    expect(msgs).toHaveLength(0);
  });

  it('handles updateDataModel with no path (root replacement)', () => {
    const parser = createA2uiMessageParser();
    const msgs = parser.push('{"version":"v0.9","updateDataModel":{"surfaceId":"s1","value":{"key":"val"}}}\n');
    expect(msgs[0]).toEqual({
      type: 'updateDataModel',
      surfaceId: 's1',
      value: { key: 'val' },
    });
  });

  it('handles updateDataModel with no value (delete)', () => {
    const parser = createA2uiMessageParser();
    const msgs = parser.push('{"version":"v0.9","updateDataModel":{"surfaceId":"s1","path":"/old"}}\n');
    expect(msgs[0]).toEqual({
      type: 'updateDataModel',
      surfaceId: 's1',
      path: '/old',
    });
  });

  it('preserves createSurface theme', () => {
    const parser = createA2uiMessageParser();
    const msgs = parser.push('{"version":"v0.9","createSurface":{"surfaceId":"s1","catalogId":"basic","theme":{"primaryColor":"#00BFFF"}}}\n');
    expect((msgs[0] as any).theme).toEqual({ primaryColor: '#00BFFF' });
  });
});
