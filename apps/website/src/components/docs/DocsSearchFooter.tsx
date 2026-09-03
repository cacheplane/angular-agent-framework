'use client';

import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Pill } from '../ui/Pill';

/**
 * The invitation to search, at the foot of a docs page.
 *
 * A button rather than the instruction it used to be: "Press ⌘K" is not an
 * affordance on a device with no ⌘K. It dispatches the same synthetic keydown
 * the control plane's own search trigger uses (see DocsControlPlane), so
 * `DocsSearch` needs no new entry point.
 *
 * The ⌘K pill is `aria-hidden`, matching the control plane trigger's own
 * hint: there is nothing to press on a device with no keyboard, so it is
 * decoration, not part of the accessible name.
 */
export function DocsSearchFooter() {
  const openSearch = () =>
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', metaKey: true })
    );

  return (
    <Section surface="tinted" tight ariaLabelledBy="search-prompt-heading">
      <Container>
        <div className="docs-index-search-inner">
          <h2 id="search-prompt-heading" className="docs-index-search-heading">
            Looking for something specific?
          </h2>
          <button
            type="button"
            className="docs-index-search-button"
            onClick={openSearch}
          >
            Search the docs
            <Pill variant="neutral" aria-hidden="true">⌘K</Pill>
          </button>
        </div>
      </Container>
    </Section>
  );
}
