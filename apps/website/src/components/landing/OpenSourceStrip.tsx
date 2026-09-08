'use client';

import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Button } from '../ui/Button';
import { GitHubIcon } from '../ui/GitHubIcon';
import { trackCtaClick } from '../../lib/analytics/client';
import { GITHUB_REPO_URL, OPEN_SOURCE_STRIP } from '../../lib/positioning';

/**
 * The homepage's open-source beat: one dark strip between the stage and the
 * teams block.
 *
 * It replaced a full dark `FinalCTA` (the "prove the Angular UI" closer). The
 * point of the section is that there is no catch and no upsell, so it is
 * deliberately the quietest band on the page: one sentence at the left edge of
 * the page container, the licence and the repo at the right, and no second
 * pitch. The four library pages still close on `FinalCTA variant="dark"` —
 * that component is untouched.
 */
export function OpenSourceStrip() {
  return (
    <Section
      surface="dark"
      tight
      ariaLabelledBy="open-source-heading"
      className="open-source-strip"
    >
      <Container>
        <div className="open-source-strip-inner">
          <h2 id="open-source-heading" className="open-source-strip-line">
            {OPEN_SOURCE_STRIP.lead}{' '}
            <em>{OPEN_SOURCE_STRIP.emphasis}</em>
          </h2>
          <div className="open-source-strip-actions">
            <span className="open-source-strip-licence">
              {OPEN_SOURCE_STRIP.licence}
            </span>
            <Button
              variant="secondary"
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
          </div>
        </div>
      </Container>
    </Section>
  );
}
