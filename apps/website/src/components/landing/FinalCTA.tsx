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
}

const DEFAULT_SECONDARY = { label: 'See each feature in action →', href: 'https://cockpit.threadplane.ai', external: true };

export function FinalCTA({
  headline = 'Stop stalling on agentic Angular.',
  subtext = 'Install the framework, read the docs, and have a streaming chat in your app this afternoon.',
  primary = null,
  secondary = DEFAULT_SECONDARY,
  caption = 'Most packages are MIT · @threadplane/chat requires a production license · App telemetry off by default',
}: FinalCTAProps = {}) {
  return (
    <Section surface="tinted" ariaLabelledBy="final-cta-heading">
      <Container>
        <div className="final-cta-inner">
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
