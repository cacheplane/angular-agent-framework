import { tokens } from '@ngaf/design-tokens';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Button } from '../ui/Button';

interface FinalCTAProps {
  /** Headline. Defaults to the homepage closer. */
  headline?: string;
  /** Sub-headline. Defaults to the homepage closer. */
  subtext?: string;
  /** Primary CTA. Defaults to "Get started" → /docs. */
  primary?: { label: string; href: string };
  /** Optional secondary CTA. Defaults to "See it live →" → cockpit. */
  secondary?: { label: string; href: string; external?: boolean } | null;
  /** Optional trailing caption. Defaults to MIT line. Pass null to hide. */
  caption?: string | null;
}

const DEFAULT_PRIMARY = { label: 'Get started', href: '/docs' };
const DEFAULT_SECONDARY = { label: 'See it live →', href: 'https://cockpit.cacheplane.ai', external: true };

export function FinalCTA({
  headline = 'Stop stalling on agentic Angular.',
  subtext = 'Install the framework, read the docs, and have a streaming chat in your app this afternoon.',
  primary = DEFAULT_PRIMARY,
  secondary = DEFAULT_SECONDARY,
  caption = 'MIT · No signup required · App telemetry off by default',
}: FinalCTAProps = {}) {
  return (
    <Section surface="tinted" ariaLabelledBy="final-cta-heading">
      <Container>
        <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <h2
            id="final-cta-heading"
            style={{
              fontFamily: tokens.typography.h2.family,
              fontSize: tokens.typography.h2.size,
              lineHeight: tokens.typography.h2.line,
              fontWeight: 700,
              color: tokens.colors.textPrimary,
              margin: 0,
              marginBottom: 16,
              letterSpacing: '-0.015em',
              fontStyle: 'italic',
            }}
          >
            {headline}
          </h2>
          <p
            style={{
              fontFamily: tokens.typography.bodyLg.family,
              fontSize: tokens.typography.bodyLg.size,
              lineHeight: tokens.typography.bodyLg.line,
              color: tokens.colors.textSecondary,
              margin: 0,
              marginBottom: 32,
            }}
          >
            {subtext}
          </p>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 12,
              flexWrap: 'wrap',
              marginBottom: 16,
            }}
          >
            <Button variant="primary" size="lg" href={primary.href}>
              {primary.label}
            </Button>
            {secondary ? (
              <Button
                variant="ghost"
                size="lg"
                href={secondary.href}
                {...(secondary.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              >
                {secondary.label}
              </Button>
            ) : null}
          </div>
          {caption ? (
            <p
              style={{
                fontFamily: tokens.typography.caption.family,
                fontSize: tokens.typography.caption.size,
                color: tokens.colors.textMuted,
                margin: 0,
              }}
            >
              {caption}
            </p>
          ) : null}
        </div>
      </Container>
    </Section>
  );
}
