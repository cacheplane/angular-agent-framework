// SPDX-License-Identifier: MIT
import type { Metadata } from 'next';
import React, { Suspense } from 'react';
import { tokens } from '@ngaf/design-tokens';
import { Container } from '../../components/ui/Container';
import { Section } from '../../components/ui/Section';
import { Eyebrow } from '../../components/ui/Eyebrow';
import { ContactForm } from '../../components/contact/ContactForm';
import { GitHubStarsPill } from '../../components/contact/GitHubStarsPill';
import { SlaCard } from '../../components/contact/SlaCard';
import { AltChannelRow } from '../../components/contact/AltChannelRow';

export const metadata: Metadata = {
  title: 'Talk to an engineer — Cacheplane',
  description:
    "Tell us what you're shipping. We'll reply within one business day — usually with code, not a calendar invite.",
  openGraph: {
    title: 'Talk to an engineer — Cacheplane',
    description: "Tell us what you're shipping. We'll reply within one business day.",
    type: 'website',
  },
};

export default function ContactPage() {
  return (
    <Section surface="canvas" ariaLabelledBy="contact-heading">
      <Container>
        <div style={{ maxWidth: 720 }}>
          <Eyebrow tone="accent" style={{ marginBottom: 16 }}>Contact</Eyebrow>
          <h1
            id="contact-heading"
            style={{
              fontFamily: tokens.typography.h1.family,
              fontSize: tokens.typography.h1.size,
              lineHeight: tokens.typography.h1.line,
              fontWeight: 700,
              color: tokens.colors.textPrimary,
              margin: 0,
              marginBottom: 16,
              letterSpacing: '-0.02em',
            }}
          >
            Talk to an engineer.
          </h1>
          <p
            style={{
              fontFamily: tokens.typography.bodyLg.family,
              fontSize: tokens.typography.bodyLg.size,
              lineHeight: tokens.typography.bodyLg.line,
              color: tokens.colors.textSecondary,
              margin: 0,
              marginBottom: 24,
              maxWidth: '60ch',
            }}
          >
            Tell us what you&apos;re shipping. We&apos;ll reply within one business day — usually with code, not a calendar invite.
          </p>
          <div style={{ marginBottom: 24 }}>
            <SlaCard />
          </div>
          <Suspense>
            <ContactForm />
          </Suspense>
          <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <GitHubStarsPill />
            <AltChannelRow />
          </div>
        </div>
      </Container>
    </Section>
  );
}
