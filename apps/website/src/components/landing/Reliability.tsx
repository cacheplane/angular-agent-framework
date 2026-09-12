import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { SectionHeader } from '../ui/SectionHeader';
import { HERO_TRUST_LINE } from '../../lib/positioning';
import { PreflightChecklist } from './PreflightChecklist';

/**
 * The trust section (homepage design spec §3, block 2): the sourced proof
 * band, reduced on 2026-09-11 to the five third-party figures.
 *
 * Replaces ProofStrip and LogoRibbon, both deleted with the homepage
 * restructure, and the 27-row preflight checklist that followed them. The
 * Threadplane and Yours columns of that checklist were self-reported; the
 * airworthiness rows are not, and they are all that stays. The boundary
 * argument the Yours column used to make now lives in the No-runtime band
 * (NoRuntimeBand.tsx) and in the docs.
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
        * Keep the two colours distinct: the bar is --color-scope #15253E; the
        * band is a darker gradient (#0B1622 → #0F1C2E) that never reaches it,
        * so the bar sits lighter against the band below, and that difference
        * is what stops the bar dissolving into it. */}
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
              aside="Not self-reported. Every figure links to the body that published it."
            />
            <PreflightChecklist />
          </div>
        </div>
      </Container>
    </Section>
  );
}
