import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { SectionHeader } from '../ui/SectionHeader';
import { HighlightedCode } from './HighlightedCode';
import { COMPONENT_SNIPPET, INSTALL_OPTIONS, RENDER_SNIPPET } from '../../lib/positioning';

const STEPS = [
  {
    title: 'Choose an adapter',
    body: 'Connect LangGraph or an AG-UI endpoint, or start with a fake agent. This is the only file that knows which runtime you run.',
    code: INSTALL_OPTIONS[1].providerSnippet,
  },
  {
    title: 'Inject signal-shaped state',
    body: 'provideAgent() once, injectAgent() where the UI needs messages, status, errors, tool progress and thread actions.',
    code: COMPONENT_SNIPPET,
  },
  {
    title: 'Render the experience you own',
    body: 'Use the chat compositions, the headless primitives, or register your own design-system components for generated UI.',
    code: RENDER_SNIPPET,
  },
] as const;

/**
 * The mechanism, in three steps (spec §7). Every snippet comes from
 * `positioning.ts`, where a parse test keeps it real TypeScript.
 */
export function ThreeSteps() {
  return (
    <Section surface="canvas" id="how-it-works" ariaLabelledBy="how-it-works-heading">
      <Container>
        <SectionHeader
          variant="rail"
          eyebrow="How it works"
          heading="From agent endpoint to Angular UI in three steps."
          headingId="how-it-works-heading"
        />
        <ol className="three-steps">
          {STEPS.map((step) => (
            <li className="three-step" key={step.title}>
              <h3 className="three-step-title">{step.title}</h3>
              <p className="three-step-body">{step.body}</p>
              <div className="three-step-code">
                <HighlightedCode code={step.code} />
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  );
}
