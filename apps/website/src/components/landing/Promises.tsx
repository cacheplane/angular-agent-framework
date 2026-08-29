import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import { Card } from '../ui/Card';

const PROMISES = [
  {
    title: 'No runtime lock-in',
    body: 'MIT adapters and render primitives stay open. @threadplane/chat is free for noncommercial use and commercially licensed for production.',
  },
  {
    title: 'No abandoned majors',
    body: 'We support Angular’s current and previous LTS versions.',
  },
  {
    title: 'No required cloud',
    body: 'Self-host LangGraph + your Angular app. Run it all in your VPC.',
  },
  {
    title: 'No app telemetry',
    body: 'We don’t collect prompts, completions, tool data, or app runtime content by default. Package installs send a minimal opt-out ping.',
  },
  {
    title: 'No model lock-in',
    body: 'Adapters work with any LLM your runtime supports. Swap providers without changing Angular code.',
  },
];

export function Promises() {
  return (
    <Section surface="canvas" ariaLabelledBy="promises-heading">
      <Container>
        <div className="promises-intro">
          <Eyebrow tone="accent" className="promises-eyebrow">
            Built on principles
          </Eyebrow>
          <h2 id="promises-heading" className="promises-heading">
            What we won&apos;t do.
          </h2>
          <p className="promises-subhead">
            Honest commitments, not aspirations.
          </p>
        </div>
        <div className="promises-grid">
          {PROMISES.map((p) => (
            <Card key={p.title} padding="lg">
              <h3 className="promises-card-title">
                {p.title}
              </h3>
              <p className="promises-card-body">
                {p.body}
              </p>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  );
}
