import Link from 'next/link';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import {
  HERO_TRUST_LINE,
  STAGE_CLOSE,
  STAGE_RAIL,
} from '../../lib/positioning';
import type { StageBeat } from '../../lib/stage-beats';

export const STAGE_STILL_MOBILE_MEDIA = '(max-width: 767px)';
const STILL_W = 1200;
const STILL_H = 720;
const STILL_MOBILE_W = 585;
const STILL_MOBILE_H = 975;

interface Props {
  /** One proof line per beat, derived from the recording on the server. */
  proof: Record<StageBeat, string>;
}

/**
 * The stage's non-pinned form (spec §8, stage-rail spec §6): the same four
 * beats as four stacked stills from `/stage`, each with its beat block, then
 * the ledger ending once. Server-rendered by default; `Stage` swaps in the
 * pinned act on wide, motion-tolerant viewports.
 *
 * This is the page's no-JS and phone form, so nothing is hidden and every
 * link stays in the tab order. A still IS the settle, so its check is always
 * filled.
 */
export function StageStills({ proof }: Props) {
  return (
    <Section id="stage" surface="canvas" ariaLabelledBy="stage-heading">
      <Container>
        <h2 id="stage-heading" className="sr-only">
          One real run: tools, persist, approve, render
        </h2>
        <div className="stage-stills">
          {STAGE_RAIL.map((b) => (
            <article
              className="stage-still"
              data-testid="stage-still-beat"
              data-beat={b.beat}
              key={b.beat}
            >
              <div className="stage-still-visual">
                <picture>
                  <source
                    media={STAGE_STILL_MOBILE_MEDIA}
                    srcSet={`/screenshots/stage-${b.beat}-mobile.webp`}
                    width={STILL_MOBILE_W}
                    height={STILL_MOBILE_H}
                  />
                  <img
                    src={`/screenshots/stage-${b.beat}.webp`}
                    width={STILL_W}
                    height={STILL_H}
                    alt={b.stillAlt}
                    loading="lazy"
                    decoding="async"
                    className="stage-still-img"
                  />
                </picture>
              </div>
              <div className="stage-still-text">
                <span className="stage-check" data-checked aria-hidden="true" />
                <div>
                  <h3 className="stage-claim">{b.claim}</h3>
                  <Link href={b.docs.href} className="stage-doc">
                    {b.docs.label}
                  </Link>
                  <p className="stage-proof" data-stage-proof>
                    {proof[b.beat]}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
        <div
          className="stage-rail-close stage-stills-close"
          data-testid="stage-stills-close"
        >
          <ul className="stage-ledger">
            {STAGE_RAIL.map((b) => (
              <li key={b.beat}>
                <span className="stage-check" data-checked aria-hidden="true" />
                <span className="stage-ledger-claim">{b.claim}</span>
                <Link href={b.docs.href} className="stage-doc">
                  {b.docs.label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="stage-claim">{STAGE_CLOSE.claim}</p>
          <div className="stage-install">
            <code>{STAGE_CLOSE.install}</code>
            <Link href={STAGE_CLOSE.cta.href} className="stage-install-cta">
              {STAGE_CLOSE.cta.label} →
            </Link>
          </div>
          <p className="stage-trust">{HERO_TRUST_LINE} · LangGraph and AG-UI</p>
        </div>
      </Container>
    </Section>
  );
}
