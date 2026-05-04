// libs/ag-ui/src/lib/bridge-citations-state.ts
// SPDX-License-Identifier: MIT
import type { Citation, Message } from '@ngaf/chat';

interface ThreadStateLike {
  state?: Record<string, unknown>;
}

export function bridgeCitationsState(thread: ThreadStateLike, messages: Message[]): Message[] {
  const citationsByMsg = (thread.state as { citations?: unknown })?.citations;
  if (!citationsByMsg || typeof citationsByMsg !== 'object') return messages;
  const map = citationsByMsg as Record<string, unknown>;
  return messages.map(msg => {
    const raw = map[msg.id];
    if (!Array.isArray(raw) || raw.length === 0) return msg;
    return { ...msg, citations: raw.map((entry, i) => normalizeCitation(entry, i + 1)) };
  });
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
