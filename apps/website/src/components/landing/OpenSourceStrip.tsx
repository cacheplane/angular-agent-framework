'use client';

import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Button } from '../ui/Button';
import { GitHubIcon } from '../ui/GitHubIcon';
import { trackCtaClick } from '../../lib/analytics/client';
import { GITHUB_REPO_URL, OPEN_SOURCE_STRIP } from '../../lib/positioning';

/**
 * The homepage's open-source beat: a dark full-stop band between the stage
 * and the teams block.
 *
 * It is deliberately loud. An earlier version was the quietest band on the
 * page — the reasoning was that the offer is "no catch, no upsell," so it
 * should not read as a second pitch. That restraint is now spent on purpose:
 * the open-source offer is one of the strongest things the product has to
 * say, and it is said here in two words over an aviation code.
 *
 * The band takes its ~461px from the standard section rhythm; there is no
 * padding override, which is why `tight` is absent rather than false.
 *
 * The four library pages still close on `FinalCTA variant="dark"` — that
 * component is untouched.
 */
export function OpenSourceStrip() {
  return (
    <Section
      surface="dark"
      ariaLabelledBy="open-source-heading"
      className="open-source-strip"
    >
      <Container>
        <p className="open-source-strip-eyebrow">{OPEN_SOURCE_STRIP.eyebrow}</p>
        <h2 id="open-source-heading" className="open-source-strip-headline">
          {OPEN_SOURCE_STRIP.headline}
        </h2>
        <div className="open-source-strip-actions">
          <Button
            variant="primary"
            size="md"
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            leadingIcon={<GitHubIcon />}
            onClick={() =>
              trackCtaClick({
                cta_id: 'hero_github',
                track: 'developer',
                surface: 'home',
                destination_url: GITHUB_REPO_URL,
              })
            }
          >
            {OPEN_SOURCE_STRIP.cta}
          </Button>
          <span className="open-source-strip-licence">
            {OPEN_SOURCE_STRIP.licence}
          </span>
        </div>
      </Container>
      {/* Spans the section rather than the container, so the marking runs
          edge to edge like paint on a runway. */}
      <div className="open-source-strip-runway" aria-hidden="true" />
    </Section>
  );
}
