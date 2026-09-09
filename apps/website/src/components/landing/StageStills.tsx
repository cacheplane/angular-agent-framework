import Link from 'next/link';
import { StageInstallAction } from './StageInstallAction';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import {
  HERO_TRUST_LINE,
  STAGE_CLOSE,
  STAGE_RAIL,
  STAGE_HEADING,
  STAGE_SUBTITLE,
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
 * The stage's non-pinned form (spec §8, stage-rail spec §6): the same five
 * beats as five stacked stills from `/stage`, each with its beat block, then
 * the install ending once. Server-rendered by default; `Stage` swaps in the
 * pinned act on wide, motion-tolerant viewports.
 *
 * This is the page's no-JS and phone form, so nothing is hidden and every
 * link stays in the tab order. A still IS the settle, so its check is always
 * filled.
 */
export function StageStills(_props: Props) {
  void _props;
  return (
    <Section id="stage" surface="canvas" ariaLabelledBy="stage-heading">
      <Container>
        <div className="stage-intro">
          <h2 id="stage-heading">{STAGE_HEADING}</h2>
          <p>{STAGE_SUBTITLE}</p>
        </div>
        <div className="stage-stills">
          {STAGE_RAIL.map((b) => (
            <article
              className="stage-still"
              data-testid="stage-still-beat"
              data-beat={b.beat}
              key={b.beat}
            >
              <div className="stage-still-text">
                <span className="stage-check" data-checked aria-hidden="true" />
                <h3 className="stage-capability">{b.label}</h3>
                <Link
                  href={b.docs.href}
                  className="stage-doc"
                  aria-label={`${b.label} documentation`}
                >
                  {b.docs.label}
                </Link>
              </div>
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
            </article>
          ))}
        </div>
        <div
          className="stage-rail-close stage-stills-close"
          data-testid="stage-stills-close"
        >
          <p className="stage-claim">{STAGE_CLOSE.claim}</p>
          <div className="stage-install">
            <StageInstallAction />
          </div>
          <p className="stage-trust">{HERO_TRUST_LINE} · LangGraph and AG-UI</p>
        </div>
      </Container>
    </Section>
  );
}
