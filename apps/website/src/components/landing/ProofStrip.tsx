import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { SectionHeader } from '../ui/SectionHeader';

interface ProofCell {
  /** Big Garamond numeral, or null when the cell renders a live badge. */
  value: string | null;
  /** Small suffix set beside the numeral (e.g. "of 119"). */
  suffix?: string;
  caption: string;
  sourceLabel: string;
  sourceHref: string;
}

/**
 * Verified 2026-08-27 against live sources (see the homepage design spec,
 * "Verification results"). The rank and score drift over time — re-verify on
 * touch, and never "round up". The HVTrust grade is deliberately a LIVE badge:
 * it sits at 81.2 against an A-band floor of 80 and has flipped grade six
 * times in one month; a hardcoded letter would be wrong on some days.
 */
export const PROOF_CELLS: readonly ProofCell[] = [
  {
    value: '#13',
    suffix: 'of 119',
    caption: 'Of all agent frameworks ranked',
    sourceLabel: 'hvtracker.net',
    sourceHref: 'https://hvtracker.net/categories/agent-frameworks/',
  },
  {
    value: '8.1',
    suffix: '/10',
    caption: 'OpenSSF Scorecard, official API',
    sourceLabel: 'securityscorecards.dev',
    sourceHref:
      'https://api.securityscorecards.dev/projects/github.com/cacheplane/angular-agent-framework',
  },
  {
    value: null,
    caption: 'HVTrust supply-chain grade, live',
    sourceLabel: 'hvtracker.net/agents/threadplane',
    sourceHref: 'https://hvtracker.net/agents/threadplane/',
  },
];

export function ProofStrip() {
  return (
    <Section surface="tinted" tight id="proof" ariaLabelledBy="proof-heading">
      <Container>
        <div className="proof-strip-grid">
          <SectionHeader
            variant="rail"
            eyebrow="Reliable to the core"
            heading="Audited, scored, published."
            headingId="proof-heading"
            aside="Not self-reported — every number links to its source."
          />
          <ul className="proof-strip-cells" role="list">
            {PROOF_CELLS.map((cell) => (
              <li className="proof-strip-cell" key={cell.caption}>
                {cell.value ? (
                  <p className="proof-strip-value">
                    {cell.value}
                    {cell.suffix ? (
                      <span className="proof-strip-suffix"> {cell.suffix}</span>
                    ) : null}
                  </p>
                ) : (
                  <img
                    className="proof-strip-badge"
                    src="https://hvtracker.net/badge/threadplane.svg"
                    alt="HVTrust grade for Threadplane (live badge)"
                    width={91}
                    height={20}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                )}
                <p className="proof-strip-caption">{cell.caption}</p>
                <a
                  className="proof-strip-source"
                  href={cell.sourceHref}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {cell.sourceLabel}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </Section>
  );
}
