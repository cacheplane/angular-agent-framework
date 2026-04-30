// SPDX-License-Identifier: MIT
import { findSymbol, getAllSymbolNames } from '../data/loader.js';

export const getApiReferenceTool = {
  name: 'get_api_reference',
  description: 'Get the full API documentation for a angular symbol',
  inputSchema: {
    type: 'object',
    properties: { symbol: { type: 'string', description: 'Symbol name, e.g. "agent"' } },
    required: ['symbol'],
  },
};

export function handleGetApiReference(args: Record<string, unknown>) {
  const symbol = args['symbol'] as string;
  const entry = findSymbol(symbol);
  if (!entry) {
    return { content: [{ type: 'text', text: `Symbol not found: "${symbol}". Available: ${getAllSymbolNames().join(', ')}` }] };
  }
  const summary = entry.comment?.summary?.map((s) => s.text).join('') ?? '';
  const params = entry.signatures?.[0]?.parameters?.map((p) => {
    const pSummary = p.comment?.summary?.map((s) => s.text).join('') ?? '';
    return `  ${p.name}: ${p.type?.name ?? 'unknown'} — ${pSummary}`;
  }).join('\n') ?? '';
  const text = [
    `## ${entry.name}`,
    `Kind: ${entry.kindString ?? 'unknown'}`,
    summary,
    params ? `Parameters:\n${params}` : '',
  ].filter(Boolean).join('\n\n');
  return { content: [{ type: 'text', text }] };
}
