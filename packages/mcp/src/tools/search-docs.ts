// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { getApiDocs } from '../data/loader.js';

export const searchDocsTool = {
  name: 'search_docs',
  description: 'Search angular documentation by keyword or phrase',
  inputSchema: {
    type: 'object',
    properties: { query: { type: 'string', description: 'Search query' } },
    required: ['query'],
  },
};

export function handleSearchDocs(args: Record<string, unknown>) {
  const query = (args['query'] as string).toLowerCase();
  const docs = getApiDocs();
  const matches: string[] = [];
  for (const child of docs.children ?? []) {
    const text = [
      child.name,
      child.comment?.summary?.map((s) => s.text).join('') ?? '',
      ...(child.signatures?.[0]?.parameters?.map(
        (p) => `${p.name}: ${p.comment?.summary?.map((s) => s.text).join('') ?? ''}`
      ) ?? []),
    ].join(' ').toLowerCase();
    if (text.includes(query)) {
      const summary = child.comment?.summary?.map((s) => s.text).join('') ?? '';
      matches.push(`## ${child.name}\n${summary}`);
    }
    if (matches.length >= 5) break;
  }
  if (matches.length === 0) {
    return { content: [{ type: 'text', text: `No results for: "${args['query']}"` }] };
  }
  return { content: [{ type: 'text', text: matches.join('\n\n---\n\n') }] };
}
