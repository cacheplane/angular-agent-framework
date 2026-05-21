// SPDX-License-Identifier: MIT
import { tokens } from '@ngaf/design-tokens';
import { Container } from '../../components/ui/Container';
import { Section } from '../../components/ui/Section';
import { Eyebrow } from '../../components/ui/Eyebrow';
import { Button } from '../../components/ui/Button';
import { createPageMetadata } from '../../lib/site-metadata';

export const metadata = createPageMetadata({
  title: 'Payment received — Threadplane',
  description: 'Your @ngaf/chat license token will be emailed shortly.',
  pathname: '/thanks',
  type: 'website',
});

export default function ThanksPage() {
  return (
    <Section surface="canvas" ariaLabelledBy="thanks-heading">
      <Container>
        <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto' }}>
          <Eyebrow tone="accent" style={{ marginBottom: 16 }}>Payment received</Eyebrow>
          <h1
            id="thanks-heading"
            style={{
              fontFamily: tokens.typography.h1.family,
              fontWeight: 700,
              fontSize: tokens.typography.h1.size,
              lineHeight: tokens.typography.h1.line,
              color: tokens.colors.textPrimary,
              margin: 0,
              marginBottom: 16,
              letterSpacing: '-0.02em',
            }}
          >
            Thanks for your purchase.
          </h1>
          <p
            style={{
              fontFamily: tokens.typography.bodyLg.family,
              fontSize: tokens.typography.bodyLg.size,
              lineHeight: tokens.typography.bodyLg.line,
              color: tokens.colors.textSecondary,
              margin: '0 auto 24px',
            }}
          >
            Your <code style={{ fontFamily: tokens.typography.fontMono }}>@ngaf/chat</code> license token will be emailed to the address on your receipt within a few minutes. Paste it into your app's <code style={{ fontFamily: tokens.typography.fontMono }}>provideChat()</code> config to activate.
          </p>
          <p
            style={{
              fontFamily: tokens.typography.body.family,
              fontSize: 13,
              lineHeight: 1.6,
              color: tokens.colors.textMuted,
              margin: '0 auto 32px',
            }}
          >
            If you don't see the email within 10 minutes, check spam or contact us.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button variant="primary" size="md" href="/docs/chat/getting-started/installation">
              Installation docs
            </Button>
            <Button variant="ghost" size="md" href="/contact">
              Contact support
            </Button>
          </div>
        </div>
      </Container>
    </Section>
  );
}
