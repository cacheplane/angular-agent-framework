'use client';

import React, { useCallback, useState } from 'react';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import { Button } from '../ui/Button';
import { trackCtaClick } from '../../lib/analytics/client';
import {
  HERO_EYEBROW,
  HERO_H1,
  HERO_PRIMARY_LABEL,
  HERO_SECONDARY_HREF,
  HERO_SECONDARY_LABEL,
  HERO_SUBHEAD_SEGMENTS,
  HERO_TRUST_LINE,
} from '../../lib/positioning';
import { HeroDemo } from './HeroDemo';
import { InstallDialog } from './InstallDialog';

export function Hero() {
  const [installOpen, setInstallOpen] = useState(false);
  const openInstall = useCallback(() => {
    trackCtaClick({ cta_id: 'hero_install_open', track: 'developer', surface: 'home' });
    setInstallOpen(true);
  }, []);
  const closeInstall = useCallback(() => setInstallOpen(false), []);

  return (
    <Section surface="canvas" ariaLabelledBy="hero-heading">
      <Container>
        <div className="hero-stack">
          <Eyebrow tone="accent" className="hero-eyebrow">{HERO_EYEBROW}</Eyebrow>
          <h1 id="hero-heading" className="hero-heading">{HERO_H1}</h1>
          <p className="hero-subhead">
            {HERO_SUBHEAD_SEGMENTS.map((segment) =>
              segment.highlight ? (
                <span className="marker-highlight" key={segment.text}>{segment.text}</span>
              ) : (
                <React.Fragment key={segment.text}>{segment.text}</React.Fragment>
              ),
            )}
          </p>
          <div className="hero-cta-row">
            <Button variant="primary" size="lg" onClick={openInstall}>{HERO_PRIMARY_LABEL}</Button>
            <a
              className="hero-text-link"
              href={HERO_SECONDARY_HREF}
              onClick={() => trackCtaClick({ cta_id: 'hero_live_demo', track: 'developer', surface: 'home', destination_url: HERO_SECONDARY_HREF })}
            >
              {HERO_SECONDARY_LABEL}
            </a>
          </div>
          <HeroDemo />
          <p className="hero-trust">{HERO_TRUST_LINE}</p>
        </div>
      </Container>
      <InstallDialog open={installOpen} onClose={closeInstall} />
    </Section>
  );
}
