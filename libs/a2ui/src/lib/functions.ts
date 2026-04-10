// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

type FnExecutor = (args: Record<string, unknown>, model: Record<string, unknown>) => unknown;

const FUNCTIONS: Record<string, FnExecutor> = {
  // Validation functions
  required: (args) => args['value'] != null && String(args['value']).trim() !== '',
  regex: (args) => new RegExp(String(args['pattern'])).test(String(args['value'] ?? '')),
  length: (args) => {
    const len = String(args['value'] ?? '').length;
    return len >= Number(args['min'] ?? 0) && len <= Number(args['max'] ?? Infinity);
  },
  numeric: (args) => {
    const n = Number(args['value']);
    return !isNaN(n) && n >= Number(args['min'] ?? -Infinity) && n <= Number(args['max'] ?? Infinity);
  },
  email: (args) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(args['value'] ?? '')),

  // Formatting functions
  formatString: (args) => {
    const template = String(args['template'] ?? '');
    return template.replace(/\$\{(\w+)\}/g, (_, key) => String(args[key] ?? ''));
  },
  formatNumber: (args) => {
    const n = Number(args['value']);
    const precision = Number(args['precision'] ?? 0);
    if (args['grouping']) {
      return n.toLocaleString(undefined, { minimumFractionDigits: precision, maximumFractionDigits: precision });
    }
    return n.toFixed(precision);
  },
  formatCurrency: (args) => {
    return Number(args['value']).toLocaleString(
      String(args['locale'] ?? 'en-US'),
      { style: 'currency', currency: String(args['currency'] ?? 'USD') },
    );
  },
  formatDate: (args) => {
    return new Date(String(args['value'])).toLocaleDateString(
      args['locale'] != null ? String(args['locale']) : undefined,
    );
  },
  pluralize: (args) => {
    return Number(args['count']) === 1 ? String(args['singular']) : String(args['plural']);
  },

  // Logic functions
  and: (args) => {
    const values = args['values'];
    return Array.isArray(values) ? values.every(Boolean) : Object.values(args).every(Boolean);
  },
  or: (args) => {
    const values = args['values'];
    return Array.isArray(values) ? values.some(Boolean) : Object.values(args).some(Boolean);
  },
  not: (args) => !args['value'],

  // Navigation
  openUrl: (args) => {
    if (typeof globalThis.window !== 'undefined') {
      globalThis.window.open(String(args['url']), '_blank');
    }
    return null;
  },
};

export function executeFunction(
  name: string,
  args: Record<string, unknown>,
  model: Record<string, unknown>,
): unknown {
  const fn = FUNCTIONS[name];
  if (!fn) return null;
  return fn(args, model);
}
