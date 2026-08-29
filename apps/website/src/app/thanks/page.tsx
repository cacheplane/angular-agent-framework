// SPDX-License-Identifier: MIT
import { Container } from '../../components/ui/Container';
import { Section } from '../../components/ui/Section';
import { Eyebrow } from '../../components/ui/Eyebrow';
import { Button } from '../../components/ui/Button';
import { createPageMetadata } from '../../lib/site-metadata';

export const metadata = createPageMetadata({
  title: 'Payment received — Threadplane',
  description: 'Your @threadplane/chat license token will be emailed shortly.',
  pathname: '/thanks',
  type: 'website',
});

interface PageProps {
  searchParams: Promise<{ session_id?: string }>;
}

export default async function ThanksPage({ searchParams }: PageProps) {
  const { session_id: sessionId } = await searchParams;
  const portalHref =
    sessionId && /^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)
      ? `/api/portal/session?session_id=${encodeURIComponent(sessionId)}`
      : null;
  return (
    <Section surface="canvas" ariaLabelledBy="thanks-heading">
      <Container>
        <div className="thanks-inner">
          <Eyebrow tone="accent" className="thanks-eyebrow-spaced">Payment received</Eyebrow>
          <h1 id="thanks-heading" className="thanks-h1">
            Thanks for your purchase.
          </h1>
          <p className="thanks-body">
            Your <code className="thanks-code">@threadplane/chat</code> license token will be emailed to the address on your receipt within a few minutes. Paste it into your app's <code className="thanks-code">provideChat()</code> config to activate.
          </p>
          <p className="thanks-note">
            If you don't see the email within 10 minutes, check spam or contact us.
          </p>
          <div className="thanks-buttons">
            <Button variant="primary" size="md" href="/docs/licensing">
              Installation & licensing
            </Button>
            {portalHref && (
              <Button variant="secondary" size="md" href={portalHref}>
                Manage subscription
              </Button>
            )}
            <Button variant="ghost" size="md" href="/contact">
              Contact support
            </Button>
          </div>
        </div>
      </Container>
    </Section>
  );
}
