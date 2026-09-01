// @vitest-environment jsdom
import React from 'react';
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const pathname = vi.hoisted(() => ({ current: '/' }));

vi.mock('next/navigation', () => ({
  usePathname: () => pathname.current,
}));

import { SiteFooter } from './SiteFooter';

afterEach(() => {
  pathname.current = '/';
});

/**
 * The footer is mounted once, in the root layout, so it is the docs shell's
 * only way to opt out of it. These cases are the contract that opt-out obeys.
 */
describe('SiteFooter', () => {
  it.each(['/', '/pricing', '/blog/some-post', '/docs-adjacent'])(
    'renders the marketing footer on %s',
    (route) => {
      pathname.current = route;

      const { container } = render(<SiteFooter />);

      expect(container.querySelector('footer')).toBeTruthy();
    },
  );

  it.each(['/docs', '/docs/choosing-an-adapter', '/docs/langgraph/guides/testing'])(
    'suppresses it on %s so the docs stay a single sidebar pane',
    (route) => {
      pathname.current = route;

      const { container } = render(<SiteFooter />);

      expect(container.querySelector('footer')).toBeNull();
    },
  );
});
