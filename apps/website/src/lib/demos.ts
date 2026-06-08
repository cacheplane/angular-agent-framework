// apps/website/src/lib/demos.ts
export interface DemoTarget {
  /** Stable key; analytics cta_id suffix uses this (hyphens → underscores). */
  key: 'langgraph' | 'ag-ui';
  /** Label without trailing arrow — callers add their own. */
  label: string;
  href: string;
}

export const DEMOS: readonly DemoTarget[] = [
  { key: 'langgraph', label: 'LangGraph demo', href: 'https://demo.threadplane.ai' },
  { key: 'ag-ui', label: 'AG-UI demo', href: 'https://ag-ui.threadplane.ai' },
];

/** `ag-ui` → `ag_ui` for analytics ids. */
export const demoCtaSuffix = (key: DemoTarget['key']): string => key.replace(/-/g, '_');
