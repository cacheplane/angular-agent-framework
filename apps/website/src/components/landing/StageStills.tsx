import Link from 'next/link';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import { STAGE_RAIL } from '../../lib/positioning';

export const STAGE_STILL_MOBILE_MEDIA = '(max-width: 767px)';
const STILL_W = 1200;
const STILL_H = 720;
const STILL_MOBILE_W = 585;
const STILL_MOBILE_H = 975;

/**
 * The stage's non-pinned form (spec §8): the same four beats as four stacked
 * stills from `/stage`, each with its rail copy. Server-rendered by default;
 * `Stage` swaps in the pinned act on wide, motion-tolerant viewports.
 */
export function StageStills() {
  return (
    <Section id="stage" surface="canvas" ariaLabelledBy="stage-heading">
      <Container>
        <h2 id="stage-heading" className="sr-only">
          One real run: stream, persist, approve, render
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
              <div className="feature-block-text">
                <div className="feature-block-rail">
                  <Eyebrow tone="accent" className="feature-block-eyebrow">
                    {b.eyebrow}
                  </Eyebrow>
                  <span
                    className="feature-block-rail-line"
                    aria-hidden="true"
                  />
                </div>
                <h3 className="feature-block-heading">{b.headline}</h3>
                <p className="feature-block-body">{b.body}</p>
                <div className="feature-block-rows">
                  {b.rows.map((row) => (
                    <div className="feature-block-row" key={row.claim}>
                      <span className="feature-block-row-claim">
                        {row.claim}
                      </span>
                      <span className="feature-block-row-api">{row.api}</span>
                    </div>
                  ))}
                </div>
                <Link href={b.cta.href} className="feature-block-cta">
                  {b.cta.label} →
                </Link>
              </div>
            </article>
          ))}
        </div>
      </Container>
    </Section>
  );
}
