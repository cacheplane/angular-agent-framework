'use client';

import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { trackCtaClick } from '../../lib/analytics/client';
import { NO_RUNTIME_BAND } from '../../lib/positioning';

/**
 * The No-runtime band (spec 2026-09-11): a dark band between the architecture
 * diagram and Fork us, in the same loud register. Copy left, two vertical
 * flows right — the usual path with a vendor runtime in the middle, and ours
 * without it.
 *
 * Everything it says comes from NO_RUNTIME_BAND (positioning.ts). It names no
 * other product: the band states Threadplane's shape and leaves the
 * comparison to the reader.
 *
 * `'use client'` only for the analytics click handler; there is no state.
 */
export function NoRuntimeBand() {
  const { eyebrow, headline, body, link, flows, figureCaption } = NO_RUNTIME_BAND;

  return (
    <Section surface="dark" id="no-runtime" ariaLabelledBy="no-runtime-heading" className="no-runtime">
      <Container>
        <div className="no-runtime-grid">
          <div className="no-runtime-copy">
            <p className="no-runtime-eyebrow">{eyebrow}</p>
            <h2 id="no-runtime-heading" className="no-runtime-headline">
              {headline}
            </h2>
            <p className="no-runtime-body">{body}</p>
            <a
              className="no-runtime-link"
              href={link.href}
              onClick={() =>
                trackCtaClick({
                  cta_id: 'home_no_runtime_docs',
                  track: 'developer',
                  surface: 'home',
                  destination_url: link.href,
                })
              }
            >
              {link.label}
              <span aria-hidden="true"> →</span>
            </a>
          </div>

          <figure className="no-runtime-figure">
            {/* The drawn flows and the caption say the same thing; the drawing
                is hidden as a unit so a screen reader hears it once. */}
            <div className="no-runtime-flows" aria-hidden="true">
              <Flow id="usual" label={flows.usual.label} nodes={flows.usual.nodes} ghost={flows.usual.ghost} />
              <Flow id="ours" label={flows.ours.label} nodes={flows.ours.nodes} />
            </div>
            <figcaption className="no-runtime-caption">{figureCaption}</figcaption>
          </figure>
        </div>
      </Container>
      {/* Spans the section, not the container, like the Fork us runway. */}
      <div className="no-runtime-runway" aria-hidden="true" />
    </Section>
  );
}

function Flow({
  id,
  label,
  nodes,
  ghost,
}: {
  id: 'usual' | 'ours';
  label: string;
  nodes: readonly string[];
  ghost?: string;
}) {
  return (
    <div className="no-runtime-flow" data-flow={id}>
      <p className="no-runtime-flow-label">{label}</p>
      {nodes.map((node, i) => (
        <div className="no-runtime-hop" key={node}>
          {i > 0 ? <span className={`no-runtime-arrow${id === 'ours' ? ' is-direct' : ''}`} /> : null}
          <span
            className={`no-runtime-node${node === ghost ? ' is-ghost' : ''}${
              i === nodes.length - 1 ? ' is-agent' : ''
            }`}
          >
            {node}
          </span>
        </div>
      ))}
    </div>
  );
}
