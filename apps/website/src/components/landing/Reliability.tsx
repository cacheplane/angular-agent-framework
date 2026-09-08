import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { SectionHeader } from '../ui/SectionHeader';
import { WEBSITE_SUPPORTED_ANGULAR_MAJORS } from '../pricing/angular-support.mjs';
import { HERO_TRUST_LINE, RELIABILITY_RECEIPTS } from '../../lib/positioning';

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
    // Derived from the published peer range, never hardcoded.
    value: `${WEBSITE_SUPPORTED_ANGULAR_MAJORS[0]}–${WEBSITE_SUPPORTED_ANGULAR_MAJORS.at(-1)}`,
    caption: 'Angular majors supported, CI-tested',
    sourceLabel: 'npmjs.com',
    sourceHref: 'https://www.npmjs.com/package/@threadplane/langgraph',
  },
];

/**
 * The reliability section (homepage design spec §3, block 2): the sourced
 * proof band and a second line of receipts in the same grammar.
 *
 * Replaces ProofStrip and LogoRibbon, both deleted with the homepage
 * restructure.
 *
 * The works-with line used to close this section. It now has its own LIGHT
 * section (Compatibility.tsx): the vendor marks are drawn for light grounds
 * and were invisible here, and the section was carrying two arguments at once.
 */
export function Reliability() {
  return (
    <Section surface="dark" id="proof" ariaLabelledBy="proof-heading">
      {/* The seam. The hero's yellow block ends, this marks the boundary, the
        * scope band begins — which is where the ATC app puts its frequency
        * bar. It lived inside the hero until 2026-09-08, when it read as a
        * stray navy bar 78px above a much larger band of near-identical navy.
        * Keep the two colours distinct: the bar is --color-scope flat, the band
        * is a gradient that only reaches that value at its bottom, and that
        * difference is what stops the bar dissolving into it. */}
      <p className="proof-masthead">{HERO_TRUST_LINE}</p>
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
              eyebrow="Climb performance"
              heading="Audited, scored, published."
              headingId="proof-heading"
              aside="Vx clears today’s obstacle; Vy gets you to altitude. Not self-reported — every number links to its source."
            />
            {/* Attitude indicator: pitch ladder either side of an amber
              * waterline. A divider that happens to mean something — it pays
              * off the Vx/Vy line above it. Purely decorative, so
              * aria-hidden. */}
            <svg
              className="proof-ladder"
              viewBox="0 0 700 46"
              aria-hidden="true"
              focusable="false"
            >
              <g className="proof-ladder-rungs">
                <line x1="150" y1="34" x2="245" y2="34" />
                <line x1="455" y1="34" x2="550" y2="34" />
                <line x1="196" y1="16" x2="245" y2="16" />
                <line x1="455" y1="16" x2="504" y2="16" />
              </g>
              <g className="proof-ladder-wing">
                <line x1="290" y1="26" x2="330" y2="26" />
                <line x1="370" y1="26" x2="410" y2="26" />
              </g>
              <circle className="proof-ladder-dot" cx="350" cy="26" r="2.5" />
            </svg>
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
            <ul className="reliability-receipts" role="list" aria-label="Receipts">
              {RELIABILITY_RECEIPTS.map((r) => {
                const external = r.sourceHref.startsWith('http');
                return (
                  <li className="reliability-receipt" key={r.claim}>
                    <p className="reliability-receipt-claim">{r.claim}</p>
                    <p className="reliability-receipt-detail">{r.detail}</p>
                    <a
                      className="proof-strip-source"
                      href={r.sourceHref}
                      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    >
                      {r.sourceLabel}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </Container>
    </Section>
  );
}
