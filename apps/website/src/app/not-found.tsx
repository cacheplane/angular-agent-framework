import { tokens } from '@ngaf/design-tokens';
import { Container } from '../components/ui/Container';
import { Section } from '../components/ui/Section';
import { Eyebrow } from '../components/ui/Eyebrow';
import { Button } from '../components/ui/Button';

export const metadata = {
  title: 'Page not found — Agent UI for Angular',
  description: 'The page you were looking for doesn’t exist.',
};

export default function NotFound() {
  return (
    <Section surface="canvas" ariaLabelledBy="not-found-heading">
      <Container>
        <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
          <Eyebrow tone="accent" style={{ marginBottom: 16 }}>404</Eyebrow>
          <h1
            id="not-found-heading"
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
            Page not found.
          </h1>
          <p
            style={{
              fontFamily: tokens.typography.bodyLg.family,
              fontSize: tokens.typography.bodyLg.size,
              lineHeight: tokens.typography.bodyLg.line,
              color: tokens.colors.textSecondary,
              margin: '0 auto 32px',
              maxWidth: 480,
            }}
          >
            The page you were looking for doesn&apos;t exist. It may have moved, or the link
            you followed might be broken.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Button variant="primary" size="lg" href="/">
              Back home
            </Button>
            <Button variant="secondary" size="lg" href="/docs">
              Browse docs
            </Button>
          </div>
        </div>
      </Container>
    </Section>
  );
}
