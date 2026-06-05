import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Logo } from './logo';

describe('Logo', () => {
  it('renders the Threadplane wordmark', () => {
    const html = renderToStaticMarkup(<Logo />);
    expect(html).toContain('Threadplane');
  });

  it('exposes a stable data-ui selector', () => {
    const html = renderToStaticMarkup(<Logo />);
    expect(html).toContain('data-ui="cockpit-logo"');
  });
});
