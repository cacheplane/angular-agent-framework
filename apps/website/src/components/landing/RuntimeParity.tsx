import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { SectionHeader } from '../ui/SectionHeader';
import { HighlightedCode } from './HighlightedCode';
import { RuntimeParityToggle } from './RuntimeParityToggle';
import { AdapterGuideLink } from './AdapterGuideLink';
import { PARITY_SNIPPETS, PINNED_COMPONENT_SNIPPET } from '../../lib/positioning';

/**
 * Runtime parity (spec §6). Both config panes and the pinned component pane
 * are highlighted on the server and passed to the client toggle as elements,
 * so the toggle ships no shiki and never re-highlights on switch.
 */
export function RuntimeParity() {
  return (
    <Section surface="white" id="parity" ariaLabelledBy="parity-heading">
      <Container>
        <SectionHeader
          variant="rail"
          eyebrow="Runtime parity"
          heading="One Angular UI. Two runtime adapters. The same contract."
          headingId="parity-heading"
          aside="@threadplane/chat consumes Agent, not LangGraphAgent or an AG-UI client. Swap the adapter without rewriting the Angular component tree."
        />
        <RuntimeParityToggle
          configPanes={{
            langgraph: <HighlightedCode code={PARITY_SNIPPETS.langgraph} />,
            ag_ui: <HighlightedCode code={PARITY_SNIPPETS.ag_ui} />,
          }}
          componentPane={<HighlightedCode code={PINNED_COMPONENT_SNIPPET} />}
        />
        <p className="parity-qualifier">
          Not every backend emits every capability. Interrupts, subagents and checkpoints depend on
          what the runtime sends.{' '}
          <AdapterGuideLink />
        </p>
      </Container>
    </Section>
  );
}
