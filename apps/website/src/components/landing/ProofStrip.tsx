import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { SectionHeader } from '../ui/SectionHeader';
import { WEBSITE_SUPPORTED_ANGULAR_MAJORS } from '../pricing/angular-support.mjs';

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
 * Verified 2026-09-04 against live sources (see the homepage design spec,
 * "Verification results"). The rank and score drift over time — re-verify on
 * touch, and never "round up". The HVTrust grade is deliberately a LIVE badge:
 * it sits at 84.3 against an A-band floor of 80 and has flipped grade several
 * times in a month; a hardcoded letter would be wrong on some days.
 *
 * Every href must be a page a human can read. The Scorecard number comes from
 * api.securityscorecards.dev, but the LINK goes to the scorecard.dev viewer —
 * the API URL renders as raw JSON.
 */
export const PROOF_CELLS: readonly ProofCell[] = [
  {
    value: '#8',
    suffix: 'of 119',
    caption: 'Of all agent frameworks ranked',
    sourceLabel: 'hvtracker.net',
    sourceHref: 'https://hvtracker.net/categories/agent-frameworks/',
  },
  {
    value: '8.2',
    suffix: '/10',
    caption: 'OpenSSF Scorecard, official scan',
    sourceLabel: 'scorecard.dev',
    sourceHref:
      'https://scorecard.dev/viewer/?uri=github.com/cacheplane/angular-agent-framework',
  },
  {
    value: null,
    caption: 'HVTrust supply-chain grade, live',
    sourceLabel: 'hvtracker.net/agents',
    sourceHref: 'https://hvtracker.net/agents/threadplane/',
  },
  {
    // Revived per the homepage design spec's condition: npm @latest publishes
    // ^20 || ^21 || ^22 (verified 2026-08-31). Derived, never hardcoded.
    value: `${WEBSITE_SUPPORTED_ANGULAR_MAJORS[0]}–${WEBSITE_SUPPORTED_ANGULAR_MAJORS.at(-1)}`,
    caption: 'Angular majors supported, CI-tested',
    sourceLabel: 'npmjs.com',
    sourceHref: 'https://www.npmjs.com/package/@threadplane/langgraph',
  },
];

export function ProofStrip() {
  return (
    <Section surface="dark" id="proof" ariaLabelledBy="proof-heading">
      <Container>
        <div className="proof-strip">
          {/* Garamond watermark; the glyph comes from the data attribute so no
           * stray text reaches screen readers or getAllByText. */}
          <div
            className="proof-strip-watermark"
            aria-hidden="true"
            data-watermark-text="Proof"
          />
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
        </div>
      </Container>
    </Section>
  );
}
