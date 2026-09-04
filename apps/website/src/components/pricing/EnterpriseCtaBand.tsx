'use client';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import { Button } from '../ui/Button';
import { trackCtaClick } from '../../lib/analytics/client';

const HREF = '/contact?intent=enterprise&entry=pricing_enterprise_band';

export function EnterpriseCtaBand() {
  return (
    <Section id="enterprise" surface="tinted" ariaLabelledBy="enterprise-band-heading">
      <Container>
        <div className="enterprise-band">
          <Eyebrow tone="accent" className="enterprise-band-eyebrow">Enterprise</Eyebrow>
          <h2 id="enterprise-band-heading" className="enterprise-band-heading">
            Choose the support. Add delivery if you need it.
          </h2>
          <p className="enterprise-band-lede">
            Production Assurance and Pilot-to-Prod are separate choices. Tell us where you are and we will scope the right one.
          </p>
          <Button
            href={HREF}
            variant="primary"
            size="lg"
            onClick={() =>
              trackCtaClick({
                surface: 'pricing',
                destination_url: HREF,
                cta_id: 'pricing_enterprise_band',
                cta_text: 'Request a conversation',
              })
            }
          >
            Request a conversation
          </Button>
        </div>
      </Container>
    </Section>
  );
}
