// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AboutPage from './page';
import { getAuthor } from '../../lib/blog-authors';

vi.mock('../../components/ui/Container', () => ({
  Container: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('../../components/ui/Section', () => ({
  Section: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
}));
vi.mock('../../components/ui/Eyebrow', () => ({
  Eyebrow: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

const author = getAuthor('brian');

/**
 * This page is an E-E-A-T signal, so its visible prose is exactly the surface a
 * fabricated credential would appear on. These assertions tie the rendered
 * claims back to the author record rather than restating the layout.
 */
describe('AboutPage', () => {
  it('renders the bio verbatim from the author record', () => {
    render(<AboutPage />);
    // Not a substring match: any editorial embellishment around the sourced
    // sentence would still be a claim nothing in the repo supports.
    expect(screen.getByText(author.bio as string).textContent).toBe(author.bio);
  });

  it('states the name and role the author record gives, and no other', () => {
    render(<AboutPage />);
    expect(screen.getByText(`Threadplane is written and maintained by ${author.name}, ${author.role}.`))
      .toBeTruthy();
  });

  it('links the GitHub profile the record names', () => {
    render(<AboutPage />);
    expect(screen.getByRole('link', { name: `github.com/${author.github}` }).getAttribute('href'))
      .toBe(`https://github.com/${author.github}`);
  });

  it('references no image asset', () => {
    // There is no headshot in the repo. A later `<img>` here would either point
    // at a missing file or assert a likeness the project does not have.
    const { container } = render(<AboutPage />);
    expect(container.querySelectorAll('img').length).toBe(0);
  });
});
