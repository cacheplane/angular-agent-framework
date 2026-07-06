// SPDX-License-Identifier: MIT
import { highlightJson } from './json-highlight';

describe('highlightJson', () => {
  it('returns no tokens for empty input', () => {
    expect(highlightJson('')).toEqual([]);
  });

  it('classifies an object key vs a string value', () => {
    const toks = highlightJson('{"type": "Card"}');
    expect(toks.find((t) => t.text === '"type"')?.kind).toBe('key');
    expect(toks.find((t) => t.text === '"Card"')?.kind).toBe('string');
  });

  it('marks structural characters as punct', () => {
    const puncts = highlightJson('{}[],:').filter((t) => t.kind === 'punct');
    expect(puncts.map((t) => t.text)).toEqual(['{', '}', '[', ']', ',', ':']);
  });

  it('tokenizes numbers including negatives and exponents', () => {
    const nums = highlightJson('[1, -2.5, 3e4]').filter((t) => t.kind === 'number');
    expect(nums.map((t) => t.text)).toEqual(['1', '-2.5', '3e4']);
  });

  it('tokenizes true/false/null as literals', () => {
    const lits = highlightJson('[true, false, null]').filter((t) => t.kind === 'literal');
    expect(lits.map((t) => t.text)).toEqual(['true', 'false', 'null']);
  });

  it('treats an unterminated trailing string as a plain string, not a key', () => {
    const toks = highlightJson('{"title": "Streaming De');
    expect(toks.find((t) => t.text === '"title"')?.kind).toBe('key');
    const last = toks[toks.length - 1];
    expect(last.text).toBe('"Streaming De');
    expect(last.kind).toBe('string');
  });

  it('is loss-less: joining token texts reproduces the input', () => {
    const sample = '{\n  "root": "root",\n  "elements": {\n    "a": { "type": "Card" }\n  }\n}';
    expect(highlightJson(sample).map((t) => t.text).join('')).toBe(sample);
  });

  it('preserves whitespace as plain tokens', () => {
    const toks = highlightJson('{ }');
    expect(toks.map((t) => t.text).join('')).toBe('{ }');
    expect(toks.some((t) => t.kind === 'plain' && t.text === ' ')).toBe(true);
  });
});
