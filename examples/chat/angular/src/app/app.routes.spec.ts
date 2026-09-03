// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { routes } from './app.routes';
import { HeroMode } from './hero/hero-mode.component';

describe('routes', () => {
  it('registers /hero as a top-level lazy route before the shell', () => {
    const heroIndex = routes.findIndex((r) => r.path === 'hero');
    const shellIndex = routes.findIndex((r) => r.path === '' && Array.isArray(r.children));
    expect(heroIndex).toBeGreaterThan(-1);
    expect(heroIndex).toBeLessThan(shellIndex);
    expect(typeof routes[heroIndex].loadComponent).toBe('function');
  });

  it('matches /hero exactly so /hero/<anything> falls through to the shell', () => {
    const hero = routes.find((r) => r.path === 'hero');
    expect(hero?.pathMatch).toBe('full');
  });

  it('lazily resolves the hero route to HeroMode', async () => {
    const hero = routes.find((r) => r.path === 'hero');
    await expect(hero!.loadComponent!()).resolves.toBe(HeroMode);
  });
});
