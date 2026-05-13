import { vi } from 'vitest';

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
