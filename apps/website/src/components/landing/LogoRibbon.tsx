import { Container } from '../ui/Container';

interface CompatItem {
  name: string;
  logoSrc?: string;
}

interface CompatGroup {
  label: string;
  note: string;
  items: readonly CompatItem[];
}

/**
 * Compatibility boundary (spec §5). Three rows so a provider logo is never
 * read as a direct adapter. The AG-UI row lists only runtimes the site already
 * presents as reachable — the three with docs runtime sections in
 * `docs-config.ts` (AWS Strands, Microsoft Agent Framework, Mastra) plus the
 * two that ship on the /ag-ui product page's BackendsGrid. Re-verify against
 * both before editing.
 */
export const COMPAT_GROUPS: readonly CompatGroup[] = [
  {
    label: 'Direct Threadplane adapters',
    note: '@threadplane/langgraph · @threadplane/ag-ui',
    items: [
      { name: 'LangGraph', logoSrc: '/logos/langgraph.svg' },
      { name: 'AG-UI', logoSrc: '/logos/ag-ui.svg' },
    ],
  },
  {
    label: 'Backends reachable through AG-UI',
    note: 'any AG-UI-compatible endpoint',
    items: [
      { name: 'Mastra', logoSrc: '/logos/runtimes/mastra.svg' },
      { name: 'Microsoft Agent Framework', logoSrc: '/logos/runtimes/microsoft.svg' },
      { name: 'AWS Strands' },
      { name: 'Pydantic AI', logoSrc: '/logos/runtimes/pydantic.svg' },
      { name: 'CrewAI', logoSrc: '/logos/runtimes/crewai.svg' },
    ],
  },
  {
    label: 'Model providers, behind your backend',
    note: 'model choice stays in the backend you operate',
    items: [
      { name: 'OpenAI', logoSrc: '/logos/providers/openai.svg' },
      { name: 'Anthropic', logoSrc: '/logos/providers/anthropic.svg' },
      { name: 'Gemini', logoSrc: '/logos/providers/google.svg' },
      { name: 'Bedrock', logoSrc: '/logos/providers/bedrock.svg' },
      { name: 'Azure OpenAI', logoSrc: '/logos/providers/azure.svg' },
    ],
  },
];

/**
 * The compatibility boundary. Deliberately not a Section: it reads as a
 * boundary statement between the hero and the argument below it, and the three
 * labelled rows carry their own hierarchy. No links, no hover states.
 */
export function LogoRibbon() {
  return (
    <section
      aria-label="Keep your agent stack. Standardize the Angular surface."
      className="logo-ribbon"
    >
      <Container>
        <p className="logo-ribbon-heading">
          Keep your agent stack. Standardize the Angular surface.
        </p>
        <p className="logo-ribbon-lede">
          Threadplane adapts LangGraph and AG-UI into one signal-shaped Agent contract. Your model
          provider stays behind the backend you already operate.
        </p>
        <div className="logo-ribbon-groups">
          {COMPAT_GROUPS.map((group) => (
            <div className="logo-ribbon-group" key={group.label}>
              <div className="logo-ribbon-group-head">
                <span className="logo-ribbon-label">{group.label}</span>
                <span className="logo-ribbon-note">{group.note}</span>
              </div>
              <div className="logo-ribbon-line">
                {group.items.map((item) => (
                  <span className="logo-ribbon-item" key={item.name}>
                    {item.logoSrc ? (
                      <img
                        src={item.logoSrc}
                        alt=""
                        aria-hidden="true"
                        loading="lazy"
                        decoding="async"
                        className="logo-ribbon-logo"
                      />
                    ) : null}
                    <span className="logo-ribbon-name">{item.name}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
