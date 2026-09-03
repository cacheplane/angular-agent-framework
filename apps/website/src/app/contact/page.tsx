// SPDX-License-Identifier: MIT
import React, { Suspense } from 'react';
import { Container } from '../../components/ui/Container';
import { Section } from '../../components/ui/Section';
import { Eyebrow } from '../../components/ui/Eyebrow';
import { ContactForm } from '../../components/contact/ContactForm';
import { GitHubStarsPill } from '../../components/contact/GitHubStarsPill';
import { SlaCard } from '../../components/contact/SlaCard';
import { AltChannelRow } from '../../components/contact/AltChannelRow';
import { createPageMetadata } from '../../lib/site-metadata';
import { getFormPolicy } from '../../lib/growth/form-policy';

export const metadata = createPageMetadata({
  title: 'Talk to an engineer — Threadplane',
  description: "Tell us what you're shipping. We'll reply within one business day — usually with code, not a calendar invite.",
  pathname: '/contact',
  type: 'website',
});

export default function ContactPage() {
  const formPolicy = getFormPolicy();
  return (
    <Section surface="canvas" ariaLabelledBy="contact-heading">
      <Container>
        <div className="contact-page-inner">
          <Eyebrow tone="accent" className="contact-page-eyebrow-spaced">Contact</Eyebrow>
          <h1 id="contact-heading" className="contact-page-h1">
            Talk to an engineer.
          </h1>
          <p className="contact-page-subtitle">
            Tell us what you&apos;re shipping. We&apos;ll reply within one business day — usually with code, not a calendar invite.
          </p>
          <div className="contact-page-sla-wrap">
            <SlaCard />
          </div>
          <Suspense>
            <ContactForm formPolicy={formPolicy} />
          </Suspense>
          <div className="contact-page-links-row">
            <GitHubStarsPill />
            <AltChannelRow />
          </div>
        </div>
      </Container>
    </Section>
  );
}
