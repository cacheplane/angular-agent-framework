// SPDX-License-Identifier: MIT

export type JsonTokenKind = 'key' | 'string' | 'punct' | 'number' | 'literal' | 'plain';

export interface JsonToken {
  text: string;
  kind: JsonTokenKind;
}

const PUNCT = new Set(['{', '}', '[', ']', ':', ',']);
const WS = new Set([' ', '\n', '\r', '\t']);
const isWs = (c: string) => WS.has(c);
const isDigit = (c: string) => c >= '0' && c <= '9';
const isAlpha = (c: string) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
const isNumberPart = (c: string) => isDigit(c) || c === '.' || c === 'e' || c === 'E' || c === '+' || c === '-';

/**
 * Tokenize a (possibly incomplete) streaming JSON string for syntax
 * highlighting. Never throws; tolerant of truncation. A string token is
 * classified as a `key` only when it is properly closed AND the next
 * non-whitespace character is a colon; the trailing (possibly unterminated)
 * string has no colon yet and is emitted as a plain string. The token stream
 * is loss-less — concatenating every token's `text` reproduces the input.
 */
export function highlightJson(raw: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  const n = raw.length;
  let i = 0;

  while (i < n) {
    const ch = raw[i];

    if (isWs(ch)) {
      let j = i + 1;
      while (j < n && isWs(raw[j])) j++;
      tokens.push({ text: raw.slice(i, j), kind: 'plain' });
      i = j;
      continue;
    }

    if (PUNCT.has(ch)) {
      tokens.push({ text: ch, kind: 'punct' });
      i += 1;
      continue;
    }

    if (ch === '"') {
      let j = i + 1;
      let closed = false;
      while (j < n) {
        if (raw[j] === '\\') { j += 2; continue; }
        if (raw[j] === '"') { j += 1; closed = true; break; }
        j += 1;
      }
      const text = raw.slice(i, Math.min(j, n));
      let k = j;
      while (k < n && isWs(raw[k])) k++;
      const isKey = closed && k < n && raw[k] === ':';
      tokens.push({ text, kind: isKey ? 'key' : 'string' });
      i = Math.min(j, n);
      continue;
    }

    if (ch === '-' || isDigit(ch)) {
      let j = i + 1;
      while (j < n && isNumberPart(raw[j])) j++;
      tokens.push({ text: raw.slice(i, j), kind: 'number' });
      i = j;
      continue;
    }

    if (isAlpha(ch)) {
      let j = i + 1;
      while (j < n && isAlpha(raw[j])) j++;
      tokens.push({ text: raw.slice(i, j), kind: 'literal' });
      i = j;
      continue;
    }

    tokens.push({ text: ch, kind: 'plain' });
    i += 1;
  }

  return tokens;
}
