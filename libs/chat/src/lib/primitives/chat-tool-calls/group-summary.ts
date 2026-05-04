// libs/chat/src/lib/primitives/chat-tool-calls/group-summary.ts
// SPDX-License-Identifier: MIT

/**
 * Default summary text for a group of N consecutive same-name tool calls.
 * Recognizes a small set of common tool-name prefixes; falls back to a
 * generic "Called {name} N times" otherwise.
 *
 * Consumers can override the registry per-instance via the
 * `[groupSummary]` input on <chat-tool-calls>.
 */
export function summarizeGroup(name: string, count: number): string {
  const noun = nounForPrefix(name);
  if (noun) return `${noun.verb} ${count} ${pluralize(noun.singular, count)}`;
  return `Called ${name} ${count} ${count === 1 ? 'time' : 'times'}`;
}

interface NounEntry { verb: string; singular: string }

function nounForPrefix(name: string): NounEntry | null {
  if (name.startsWith('search_')) return { verb: 'Searched', singular: 'site' };
  if (name.startsWith('generate_')) return { verb: 'Generated', singular: 'item' };
  if (name.startsWith('read_')) return { verb: 'Read', singular: 'file' };
  if (name.startsWith('write_')) return { verb: 'Wrote', singular: 'file' };
  if (name.startsWith('list_')) return { verb: 'Listed', singular: 'item' };
  return null;
}

function pluralize(word: string, count: number): string {
  return count === 1 ? word : `${word}s`;
}
