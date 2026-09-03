// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { routes } from './app.routes';

describe('routes', () => {
  it('registers /hero as a top-level lazy route before the shell', () => {
    const heroIndex = routes.findIndex((r) => r.path === 'hero');
    const shellIndex = routes.findIndex((r) => r.path === '' && Array.isArray(r.children));
    expect(heroIndex).toBeGreaterThan(-1);
    expect(heroIndex).toBeLessThan(shellIndex);
    expect(typeof routes[heroIndex].loadComponent).toBe('function');
  });
});
