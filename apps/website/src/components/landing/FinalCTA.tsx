import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Button } from '../ui/Button';
import { DemoCtaPair } from './DemoCtaPair';

interface FinalCTAProps {
  /** Headline. Defaults to the homepage closer. */
  headline?: string;
  /** Sub-headline. Defaults to the homepage closer. */
  subtext?: string;
  /** Override CTA. When omitted, renders the LangGraph + AG-UI demo pair. */
  primary?: { label: string; href: string; external?: boolean } | null;
  /** Optional secondary CTA. Defaults to "See each feature in action →" → cockpit. */
  secondary?: { label: string; href: string; external?: boolean } | null;
  /** Optional trailing caption. Defaults to licensing and telemetry line. Pass null to hide. */
  caption?: string | null;
  /**
   * 'dark' renders on the dark band — homepage only, pairing with the Yes
   * wall so the inverted treatment appears twice (spec: a lone dark band
   * reads as arbitrary). All other pages keep the default tinted surface.
   */
  variant?: 'default' | 'dark';
}

const DEFAULT_SECONDARY = { label: 'See each feature in action →', href: 'https://cockpit.threadplane.ai', external: true };

export function FinalCTA({
  headline = 'Stop stalling on agentic Angular.',
  subtext = 'Install the framework, read the docs, and have a streaming chat in your app this afternoon.',
  primary = null,
  secondary = DEFAULT_SECONDARY,
  caption = 'All packages are MIT · Production support available · App telemetry off by default',
  variant = 'default',
}: FinalCTAProps = {}) {
  return (
    <Section
      surface={variant === 'dark' ? 'dark' : 'tinted'}
      className={variant === 'dark' ? 'final-cta-dark' : undefined}
      ariaLabelledBy="final-cta-heading"
    >
      <Container>
        <div className="final-cta-inner">
          {variant === 'dark' ? (
            <div className="final-cta-mark" aria-hidden="true">
              →
            </div>
          ) : null}
          <h2 id="final-cta-heading" className="final-cta-heading">
            {headline}
          </h2>
          <p className="final-cta-subtext">
            {subtext}
          </p>
          <div className="final-cta-row">
            {primary ? (
              <Button
                variant="primary"
                size="lg"
                href={primary.href}
                {...((primary as { external?: boolean }).external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              >
                {primary.label}
              </Button>
            ) : (
              <DemoCtaPair surface="final_cta" size="lg" />
            )}
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
            <p className="final-cta-caption">
              {caption}
            </p>
          ) : null}
        </div>
      </Container>
    </Section>
  );
}
