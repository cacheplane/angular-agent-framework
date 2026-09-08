import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { SectionHeader } from '../ui/SectionHeader';
import { AdapterGuideLink } from './AdapterGuideLink';

interface CompatibilityItem {
  readonly name: string;
  /** null for an entry we support but have no mark for. */
  readonly logoSrc: string | null;
}

interface CompatibilityGroup {
  readonly label: string;
  readonly items: readonly CompatibilityItem[];
}

/**
 * Grouped rather than a flat run: the previous single row put a model provider
 * beside a protocol as though they were the same kind of thing, which is not
 * the information someone evaluating this needs.
 *
 * This section is LIGHT on purpose. These marks are drawn for light grounds —
 * Anthropic's is #181818 — and on the dark band they were invisible. Moving
 * them here is the fix; no CSS filter is involved.
 */
export const COMPATIBILITY_GROUPS: readonly CompatibilityGroup[] = [
  {
    label: 'Model providers',
    items: [
      { name: 'OpenAI', logoSrc: '/logos/providers/openai.svg' },
      { name: 'Anthropic', logoSrc: '/logos/providers/anthropic.svg' },
      { name: 'Gemini', logoSrc: '/logos/providers/google.svg' },
      { name: 'Bedrock', logoSrc: '/logos/providers/bedrock.svg' },
    ],
  },
  {
    label: 'Agent runtimes',
    items: [
      { name: 'Mastra', logoSrc: '/logos/runtimes/mastra.svg' },
      { name: 'CrewAI', logoSrc: '/logos/runtimes/crewai.svg' },
      { name: 'AWS Strands', logoSrc: null },
    ],
  },
  {
    label: 'Protocols',
    items: [
      { name: 'LangGraph', logoSrc: '/logos/langgraph.svg' },
      { name: 'AG-UI', logoSrc: '/logos/ag-ui.svg' },
    ],
  },
];

/**
 * Azure OpenAI, Pydantic AI, Microsoft Agent Framework.
 *
 * Was 4 and included AWS Strands, which is now named above — it is already
 * named twice elsewhere on the page (a reliability receipt cites it), so
 * hiding it in a count was odd. Decrement this if another is promoted.
 */
export const COMPATIBILITY_MORE_COUNT = 3;

export function Compatibility() {
  return (
    <Section surface="tinted" id="compatibility" ariaLabelledBy="compatibility-heading">
      <Container>
        <SectionHeader
          variant="rail"
          eyebrow="Compatibility"
          heading="Your backend, your models, your runtime."
          headingId="compatibility-heading"
          aside="Threadplane is the UI layer. What it talks to is your choice — and swapping any of it does not mean rewriting the interface."
        />
        <div className="compatibility-groups">
          {COMPATIBILITY_GROUPS.map((group) => (
            <div className="compatibility-group" key={group.label}>
              <p className="compatibility-group-label">{group.label}</p>
              <ul className="compatibility-items" role="list">
                {group.items.map((item) => (
                  <li className="compatibility-item" key={item.name}>
                    {item.logoSrc ? (
                      <img
                        src={item.logoSrc}
                        alt=""
                        aria-hidden="true"
                        loading="lazy"
                        decoding="async"
                        className="compatibility-logo"
                      />
                    ) : null}
                    <span className="compatibility-name">{item.name}</span>
                  </li>
                ))}
                {group.label === 'Agent runtimes' ? (
                  <li className="compatibility-more">+ {COMPATIBILITY_MORE_COUNT} more</li>
                ) : null}
              </ul>
            </div>
          ))}
        </div>
        <div className="compatibility-footer">
          <AdapterGuideLink className="compatibility-link" />
          <p className="compatibility-disclaimer">
            Compatibility, not endorsement — no company here is claimed as a customer.
          </p>
        </div>
      </Container>
    </Section>
  );
}
