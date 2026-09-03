import type { ReactNode } from 'react';
import { Section } from '../ui/Section';
import { Container } from '../ui/Container';
import { SectionHeader } from '../ui/SectionHeader';
import { StreamConcept, RenderConcept, ApproveConcept, ShipConcept } from '../docs/diagrams';

interface ConceptCard {
  anchor: string;
  title: string;
  sentence: string;
  diagram: ReactNode;
}

/** Card order mirrors the FeatureBlock order below (stream, render, ship, approve). */
const CARDS: ConceptCard[] = [
  {
    anchor: '#stream',
    title: 'Stream',
    sentence: 'Tokens arrive as signals — the UI updates itself, no subscription plumbing.',
    diagram: <StreamConcept />,
  },
  {
    anchor: '#render',
    title: 'Render',
    sentence: 'A JSON spec resolves through your registry into components you already own.',
    diagram: <RenderConcept />,
  },
  {
    anchor: '#ship',
    title: 'Ship',
    sentence: 'Threads live behind the contract — a persistent backend carries them across reloads and deploys.',
    diagram: <ShipConcept />,
  },
  {
    anchor: '#approve',
    title: 'Approve',
    sentence: 'Interrupts pause for a human decision, then the agent resumes with it.',
    diagram: <ApproveConcept />,
  },
];

export function HomeConceptGrid() {
  return (
    <Section surface="canvas" id="how-it-works" ariaLabelledBy="how-it-works-heading">
      <Container>
        <div className="home-concept">
          <SectionHeader
            variant="centered"
            eyebrow="How it works"
            heading="Four ideas carry the whole surface"
            headingId="how-it-works-heading"
          />
          <div className="home-concept-grid">
            {CARDS.map((card) => (
              <div key={card.anchor} className="home-concept-card">
                {card.diagram}
                <h3 className="home-concept-title">{card.title}</h3>
                <p className="home-concept-sentence">{card.sentence}</p>
                <a className="home-concept-link" href={card.anchor}>
                  See it live
                </a>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}
