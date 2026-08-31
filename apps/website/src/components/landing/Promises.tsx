import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';

const PROMISES = [
  { no: 'No runtime lock-in', rest: 'every package is MIT, commercial or not.', tail: 'MIT, all packages' },
  { no: 'No abandoned majors', rest: "Angular's current and previous LTS, always.", tail: 'support policy' },
  { no: 'No required cloud', rest: 'run everything in your own VPC.', tail: 'self-host' },
  { no: 'No hidden telemetry', rest: 'events require an explicit application action.', tail: 'installation is inert' },
  { no: 'No model lock-in', rest: 'swap providers without touching Angular code.', tail: 'any LLM your runtime runs' },
];

export function Promises() {
  return (
    <Section surface="canvas" ariaLabelledBy="promises-heading">
      <Container>
        <div className="promises-rail">
          <Eyebrow tone="accent" className="promises-eyebrow">
            Built on principles
          </Eyebrow>
          <span className="promises-rail-line" aria-hidden="true" />
          <span className="promises-rail-aside">honest commitments, not aspirations</span>
        </div>
        <h2 id="promises-heading" className="promises-heading">
          What we won&apos;t do.
        </h2>
        <div className="promises-rows">
          {PROMISES.map((p) => (
            <div className="promises-row" key={p.no}>
              <p className="promises-row-claim">
                <span className="marker-highlight">{p.no}</span> — {p.rest}
              </p>
              <p className="promises-row-tail">{p.tail}</p>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}
