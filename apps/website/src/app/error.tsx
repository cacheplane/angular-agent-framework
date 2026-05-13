'use client';

import { useEffect } from 'react';
import { tokens } from '@ngaf/design-tokens';
import { Container } from '../components/ui/Container';
import { Section } from '../components/ui/Section';
import { Eyebrow } from '../components/ui/Eyebrow';
import { Button } from '../components/ui/Button';

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * App-router error boundary. Next.js renders this when a server or
 * client component throws an uncaught error within this route segment.
 * `reset` re-mounts the segment without a full reload.
 */
export default function ErrorBoundary({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    // Surface errors to whatever observability the app already wires up.
    // Logging via console.error so it lands in browser devtools and any
    // existing PostHog console-bridge or similar.
    console.error('Unhandled error in app router:', error);
  }, [error]);

  return (
    <Section surface="canvas" ariaLabelledBy="error-heading">
      <Container>
        <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
          <Eyebrow tone="angular" style={{ marginBottom: 16 }}>Error</Eyebrow>
          <h1
            id="error-heading"
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
            Something went wrong.
          </h1>
          <p
            style={{
              fontFamily: tokens.typography.bodyLg.family,
              fontSize: tokens.typography.bodyLg.size,
              lineHeight: tokens.typography.bodyLg.line,
              color: tokens.colors.textSecondary,
              margin: '0 auto 12px',
              maxWidth: 480,
            }}
          >
            An unexpected error stopped this page from rendering. The team has been
            notified. You can try again, or head back home.
          </p>
          {error.digest ? (
            <p
              style={{
                fontFamily: tokens.typography.fontMono,
                fontSize: 12,
                color: tokens.colors.textMuted,
                margin: '0 0 28px',
              }}
            >
              Error ID: {error.digest}
            </p>
          ) : (
            <div style={{ height: 28 }} />
          )}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Button variant="primary" size="lg" onClick={reset}>
              Try again
            </Button>
            <Button variant="secondary" size="lg" href="/">
              Back home
            </Button>
          </div>
        </div>
      </Container>
    </Section>
  );
}
