export const PRODUCT_LABELS: Record<string, string> = {
  'deep-agents': 'Deep Agents',
  'langgraph': 'LangGraph',
  'render': 'Render',
  'chat': 'Chat',
};

export function stripProductPrefix(title: string): string {
  const prefixes = ['Deep Agents ', 'LangGraph ', 'Render ', 'Chat '];
  for (const p of prefixes) {
    if (title.startsWith(p)) return title.slice(p.length);
  }
  return title;
}
