import type { PublicFormPolicy } from '../../lib/growth/form-policy';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import { WhitePaperForm, type WhitepaperId } from './WhitePaperForm';

const ROWS = [
  { claim: 'Six production-readiness dimensions', tail: '18 pages' },
  { claim: 'Error boundaries, fallbacks, observability, deploy', tail: 'concrete patterns' },
  { claim: 'No vendor pitch — what we learned shipping it', tail: 'free' },
];

interface WhitePaperBlockProps {
  /** Whitepaper variant. Determines PDF path + analytics tag. */
  paper?: WhitepaperId;
  formPolicy: PublicFormPolicy;
}

export function WhitePaperBlock({
  formPolicy,
  paper = 'overview',
}: WhitePaperBlockProps) {
  return (
    <Section surface="white" id="whitepaper-block" ariaLabelledBy="wp-heading">
      <Container>
        <div className="wp-grid">
          <div>
            <div className="wp-rail">
              <Eyebrow tone="accent" className="wp-eyebrow">Field report</Eyebrow>
              <span className="wp-rail-line" aria-hidden="true" />
            </div>
            <h2 id="wp-heading" className="wp-heading">
              The last-mile gap in Angular AI.
            </h2>
            <div className="wp-rows">
              {ROWS.map((r) => (
                <div key={r.claim} className="wp-row">
                  <p className="wp-row-claim">{r.claim}</p>
                  <p className="wp-row-tail">{r.tail}</p>
                </div>
              ))}
            </div>

            <WhitePaperForm
              paper={paper}
              formPolicy={formPolicy}
              surface="home_whitepaper"
              sourceSection="whitepaper-block"
              idPrefix={`wp-${paper}`}
            />
          </div>

          {/* Tilted whitepaper cover */}
          <div className="wp-cover-wrap" aria-hidden="true">
            <div className="wp-paper">
              <div>
                <div className="wp-cover-badge">Field report · 18 pages</div>
                <div className="wp-cover-title">From Prototype to Production</div>
                <div className="wp-cover-desc">Six production-readiness dimensions for Angular AI teams.</div>
              </div>
              <div className="wp-cover-footer">Threadplane</div>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
