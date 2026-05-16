import { vi } from 'vitest';

// jsdom doesn't implement CSS.escape; polyfill it for components that use
// CSS.escape() in event handlers (e.g. code-mode copy button).
if (typeof globalThis.CSS === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).CSS = {};
}
if (typeof globalThis.CSS.escape !== 'function') {
  globalThis.CSS.escape = (value: string): string =>
    String(value).replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);
}

// next/navigation's useRouter throws "invariant expected app router to be
// mounted" when rendered outside an AppRouterContext (e.g. via
// renderToStaticMarkup). Provide a no-op mock so components that call
// useRouter (e.g. <ThemeToggle> in the sidebar) render in tests.
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: () => undefined,
    push: () => undefined,
    replace: () => undefined,
    back: () => undefined,
    forward: () => undefined,
    prefetch: () => undefined,
  }),
}));
