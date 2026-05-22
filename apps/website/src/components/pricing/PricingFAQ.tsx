import { tokens } from '@ngaf/design-tokens';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';

interface QA {
  q: string;
  a: string;
}

const ITEMS: readonly QA[] = [
  {
    q: 'Is @ngaf/chat open source?',
    a: '@ngaf/chat is source-available under the PolyForm Noncommercial License 1.0.0. Because commercial use requires a license, it is not OSI open source.',
  },
  {
    q: 'Can I use it for free?',
    a: 'Yes. Personal, educational, nonprofit, academic, demo, open-source, and evaluation use are free under the noncommercial license.',
  },
  {
    q: 'Can I use it at work?',
    a: 'You can evaluate it at work for 30 calendar days from your first commercial use. After that, production use in a commercial product, internal tool, SaaS app, or client deliverable requires a ThreadPlane Commercial license. The eval window is good-faith — no telemetry, no registration.',
  },
  {
    q: 'Do my end users need licenses?',
    a: 'No. Commercial licenses are for the developers, organization, or production application using @ngaf/chat, depending on the plan.',
  },
  {
    q: 'Can I modify the source?',
    a: 'Yes, for permitted noncommercial use under the PolyForm Noncommercial license, or for commercial production use under a paid ThreadPlane Commercial license.',
  },
  {
    q: 'Can I redistribute it?',
    a: 'You may bundle it inside a larger licensed application. You may not redistribute it as a standalone package or as part of a competing component library, SDK, template kit, app builder, or design system.',
  },
  {
    q: 'What happens to older MIT versions?',
    a: 'Versions previously released under MIT remain available under their original license terms. The new license applies only to future versions where the license change is introduced.',
  },
];

export function PricingFAQ() {
  return (
    <Section surface="canvas" ariaLabelledBy="pricing-faq-heading">
      <Container>
        <div id="faq" style={{ maxWidth: 760, margin: '0 auto' }}>
          <Eyebrow tone="accent" style={{ marginBottom: 12 }}>FAQ</Eyebrow>
          <h2
            id="pricing-faq-heading"
            style={{
              fontFamily: tokens.typography.h2.family,
              fontSize: tokens.typography.h2.size,
              lineHeight: tokens.typography.h2.line,
              fontWeight: 700,
              color: tokens.colors.textPrimary,
              margin: 0,
              marginBottom: 24,
              letterSpacing: '-0.015em',
            }}
          >
            Licensing FAQ
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ITEMS.map((item) => (
              <details
                key={item.q}
                style={{
                  border: `1px solid ${tokens.surfaces.border}`,
                  borderRadius: 8,
                  background: tokens.surfaces.surface,
                  padding: '12px 16px',
                }}
              >
                <summary
                  style={{
                    fontFamily: tokens.typography.body.family,
                    fontSize: 16,
                    fontWeight: 600,
                    color: tokens.colors.textPrimary,
                    cursor: 'pointer',
                    listStyle: 'revert',
                  }}
                >
                  {item.q}
                </summary>
                <p
                  style={{
                    fontFamily: tokens.typography.body.family,
                    fontSize: tokens.typography.body.size,
                    lineHeight: tokens.typography.body.line,
                    color: tokens.colors.textSecondary,
                    margin: '8px 0 0',
                  }}
                >
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}
