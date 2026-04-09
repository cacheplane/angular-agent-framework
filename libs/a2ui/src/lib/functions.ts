// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

type FnExecutor = (args: Record<string, unknown>, model: Record<string, unknown>) => unknown;

const FUNCTIONS: Record<string, FnExecutor> = {
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
      String(args['locale'] ?? undefined),
    );
  },
  pluralize: (args) => {
    return Number(args['count']) === 1 ? String(args['singular']) : String(args['plural']);
  },
  openUrl: (args) => {
    if (typeof globalThis.window !== 'undefined') {
      globalThis.window.open(String(args['url']), '_blank');
    }
    return null;
  },
  and: (args) => Object.values(args).every(Boolean),
  or: (args) => Object.values(args).some(Boolean),
  not: (args) => !args['value'],
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
