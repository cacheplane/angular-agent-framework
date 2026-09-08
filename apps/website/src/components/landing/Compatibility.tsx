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
 * This list is COMPLETE — every integration is named. It used to stop at nine
 * and close the runtimes group with a "+ 3 more" badge, which mis-filed Azure
 * OpenAI (a model provider) as a runtime and left a count that only stayed
 * honest if an editor remembered to decrement it. There is no hidden count to
 * keep in step now; add an entry to the group it actually belongs to.
 *
 * "Works with" is a compatibility claim, never a customer claim: logos are
 * `alt="" aria-hidden` beside visible names, and no wording may imply these
 * companies use Threadplane. Compatibility.spec.tsx guards both halves.
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
      { name: 'Azure OpenAI', logoSrc: '/logos/providers/azure.svg' },
    ],
  },
  {
    label: 'Agent runtimes',
    items: [
      { name: 'Mastra', logoSrc: '/logos/runtimes/mastra.svg' },
      { name: 'CrewAI', logoSrc: '/logos/runtimes/crewai.svg' },
      { name: 'Pydantic AI', logoSrc: '/logos/runtimes/pydantic.svg' },
      { name: 'Microsoft Agent Framework', logoSrc: '/logos/runtimes/microsoft.svg' },
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
 * Derived, never hand-written: each group's `<ul>` takes its accessible name
 * from the sibling label through this id, so rewording a label cannot leave
 * the list unnamed.
 */
const groupId = (label: string) => `compatibility-${label.toLowerCase().replace(/\s+/g, '-')}`;

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
              <p className="compatibility-group-label" id={groupId(group.label)}>
                {group.label}
              </p>
              <ul
                className="compatibility-items"
                role="list"
                aria-labelledby={groupId(group.label)}
              >
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
