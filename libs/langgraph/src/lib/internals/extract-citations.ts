// libs/langgraph/src/lib/internals/extract-citations.ts
// SPDX-License-Identifier: MIT
import type { Citation } from '@ngaf/chat';

interface KwargsLike {
  additional_kwargs?: Record<string, unknown> | undefined;
}

export function extractCitations(msg: KwargsLike): Citation[] | undefined {
  const raw = msg.additional_kwargs?.['citations'] ?? msg.additional_kwargs?.['sources'];
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  return raw.map((entry, i) => normalizeCitation(entry, i + 1));
}

function normalizeCitation(entry: unknown, fallbackIndex: number): Citation {
  if (typeof entry === 'string') {
    return { id: `c${fallbackIndex}`, index: fallbackIndex, url: entry };
  }
  const e = (entry ?? {}) as Record<string, unknown>;
  const str = (key: string): string | undefined =>
    typeof e[key] === 'string' ? (e[key] as string) : undefined;
  const firstStr = (...keys: string[]): string | undefined => {
    for (const k of keys) {
      const v = str(k);
      if (v !== undefined) return v;
    }
    return undefined;
  };
  return {
    id: str('id') ?? str('refId') ?? `c${fallbackIndex}`,
    index: typeof e['index'] === 'number' ? (e['index'] as number) : fallbackIndex,
    title: firstStr('title', 'name'),
    url: firstStr('url', 'href', 'source'),
    snippet: firstStr('snippet', 'content', 'excerpt'),
    extra:
      typeof e['extra'] === 'object' && e['extra'] !== null
        ? (e['extra'] as Record<string, unknown>)
        : undefined,
  };
}
