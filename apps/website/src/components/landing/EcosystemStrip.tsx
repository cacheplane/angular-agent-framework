import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';

interface EcosystemItem {
  name: string;
  note: string;
  logoSrc?: string;
}

interface EcosystemGroup {
  title: string;
  items: EcosystemItem[];
}

const ECOSYSTEM_GROUPS: EcosystemGroup[] = [
  {
    title: 'Model providers',
    items: [
      { name: 'OpenAI', note: 'model provider', logoSrc: '/logos/providers/openai.svg' },
      { name: 'Anthropic', note: 'model provider', logoSrc: '/logos/providers/anthropic.svg' },
      { name: 'Google Gemini', note: 'model provider', logoSrc: '/logos/providers/google.svg' },
      { name: 'Azure OpenAI', note: 'cloud provider', logoSrc: '/logos/providers/azure.svg' },
      { name: 'Amazon Bedrock', note: 'cloud provider', logoSrc: '/logos/providers/bedrock.svg' },
    ],
  },
  {
    title: 'Agent runtimes',
    items: [
      { name: 'LangGraph', note: 'native adapter', logoSrc: '/logos/langgraph.svg' },
      { name: 'AG-UI', note: 'protocol adapter', logoSrc: '/logos/runtimes/copilotkit.svg' },
      { name: 'CrewAI', note: 'via AG-UI', logoSrc: '/logos/runtimes/crewai.svg' },
      { name: 'Mastra', note: 'via AG-UI', logoSrc: '/logos/runtimes/mastra.svg' },
      { name: 'Pydantic AI', note: 'via AG-UI', logoSrc: '/logos/runtimes/pydantic.svg' },
      { name: 'Microsoft Agent Framework', note: 'via AG-UI', logoSrc: '/logos/runtimes/microsoft.svg' },
      { name: 'AWS Strands', note: 'via AG-UI', logoSrc: '/logos/providers/bedrock.svg' },
      { name: 'CopilotKit Runtime', note: 'via AG-UI', logoSrc: '/logos/runtimes/copilotkit.svg' },
    ],
  },
  {
    title: 'Angular surface',
    items: [
      { name: 'Angular', note: 'native DI + signals', logoSrc: '/logos/surface/angular.svg' },
      { name: 'RxJS', note: 'interop ready', logoSrc: '/logos/surface/reactivex.svg' },
      { name: 'Vercel json-render', note: 'render protocol', logoSrc: '/logos/surface/vercel.svg' },
      { name: 'Google A2UI', note: 'render protocol', logoSrc: '/logos/providers/google.svg' },
    ],
  },
];

function EcosystemTile({ item }: { item: EcosystemItem }) {
  return (
    <div data-ui="ecosystem-tile">
      {item.logoSrc ? (
        <img
          src={item.logoSrc}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className="ecosystem-tile-logo"
        />
      ) : null}
      <div className="ecosystem-tile-body">
        <div className="ecosystem-tile-name">
          {item.name}
        </div>
        <div className="ecosystem-tile-note">
          {item.note}
        </div>
      </div>
    </div>
  );
}

export function EcosystemStrip() {
  return (
    <Section surface="tinted" tight ariaLabelledBy="ecosystem-heading">
      <Container>
        <div className="ecosystem-intro">
          <Eyebrow tone="accent" className="ecosystem-eyebrow">
            Works with your agent stack
          </Eyebrow>
          <h2 id="ecosystem-heading" className="ecosystem-heading">
            Bring the model, runtime, and UI protocol you already use.
          </h2>
          <p className="ecosystem-subhead">
            Threadplane gives Angular teams production-ready chat, durable threads, interrupts, subagents, planning, memory, and generative UI without locking the backend to one provider.
          </p>
        </div>

        <div className="ecosystem-groups">
          {ECOSYSTEM_GROUPS.map((group) => (
            <div key={group.title} className="ecosystem-row">
              <div className="ecosystem-row-title">
                {group.title}
              </div>
              <div className="ecosystem-row-tiles">
                {group.items.map((item) => (
                  <EcosystemTile key={`${group.title}-${item.name}`} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}
