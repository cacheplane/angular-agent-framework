import { Container } from '../ui/Container';

interface RibbonItem {
  name: string;
  logoSrc: string;
}

export const RIBBON_ITEMS: readonly RibbonItem[] = [
  { name: 'OpenAI', logoSrc: '/logos/providers/openai.svg' },
  { name: 'Anthropic', logoSrc: '/logos/providers/anthropic.svg' },
  { name: 'Gemini', logoSrc: '/logos/providers/google.svg' },
  { name: 'Bedrock', logoSrc: '/logos/providers/bedrock.svg' },
  { name: 'LangGraph', logoSrc: '/logos/langgraph.svg' },
  { name: 'AG-UI', logoSrc: '/logos/ag-ui.svg' },
  { name: 'CrewAI', logoSrc: '/logos/runtimes/crewai.svg' },
  { name: 'Mastra', logoSrc: '/logos/runtimes/mastra.svg' },
];

/** Azure OpenAI, Pydantic AI, Microsoft Agent Framework, AWS Strands. */
export const RIBBON_MORE_COUNT = 4;

/**
 * The "works with" recognition line (spec change 1). Deliberately not a
 * Section: no heading, no subhead — the portability argument lives in the
 * Yes wall; this keeps only recognition. No links, no hover states.
 */
export function LogoRibbon() {
  return (
    <section aria-label="Works with your agent stack" className="logo-ribbon">
      <Container>
        <div className="logo-ribbon-line">
          <span className="logo-ribbon-label">Works with</span>
          {RIBBON_ITEMS.map((item) => (
            <span className="logo-ribbon-item" key={item.name}>
              <img
                src={item.logoSrc}
                alt=""
                aria-hidden="true"
                loading="lazy"
                decoding="async"
                className="logo-ribbon-logo"
              />
              <span className="logo-ribbon-name">{item.name}</span>
            </span>
          ))}
          <span className="logo-ribbon-more">+ {RIBBON_MORE_COUNT} more</span>
        </div>
      </Container>
    </section>
  );
}
