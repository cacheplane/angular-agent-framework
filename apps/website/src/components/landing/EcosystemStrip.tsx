import { tokens } from '@ngaf/design-tokens';
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
    <div
      data-ui="ecosystem-tile"
      style={{
        minHeight: 76,
        border: `1px solid ${tokens.surfaces.border}`,
        borderRadius: tokens.radius.sm,
        background: tokens.surfaces.surface,
        boxShadow: tokens.shadows.sm,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 5,
        transition: 'border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease',
      }}
    >
      {item.logoSrc ? (
        <img
          src={item.logoSrc}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          style={{
            width: 24,
            height: 24,
            objectFit: 'contain',
            flex: '0 0 auto',
            marginRight: 8,
          }}
        />
      ) : null}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: tokens.typography.fontSans,
            fontSize: 15,
            lineHeight: 1.25,
            fontWeight: 700,
            color: tokens.colors.textPrimary,
          }}
        >
          {item.name}
        </div>
        <div
          style={{
            fontFamily: tokens.typography.fontMono,
            fontSize: 10,
            lineHeight: 1.4,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: tokens.colors.textMuted,
          }}
        >
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
        <div style={{ maxWidth: 780, margin: '0 auto 28px', textAlign: 'center' }}>
          <Eyebrow tone="accent" style={{ marginBottom: 12 }}>
            Works with your agent stack
          </Eyebrow>
          <h2
            id="ecosystem-heading"
            style={{
              fontFamily: tokens.typography.h2.family,
              fontSize: tokens.typography.h2.size,
              lineHeight: tokens.typography.h2.line,
              fontWeight: 700,
              color: tokens.colors.textPrimary,
              margin: 0,
              marginBottom: 14,
              letterSpacing: 0,
            }}
          >
            Bring the model, runtime, and UI protocol you already use.
          </h2>
          <p
            style={{
              fontFamily: tokens.typography.bodyLg.family,
              fontSize: tokens.typography.bodyLg.size,
              lineHeight: tokens.typography.bodyLg.line,
              color: tokens.colors.textSecondary,
              margin: 0,
            }}
          >
            NGAF gives Angular teams production-ready chat, durable threads, interrupts, subagents, planning, memory, and generative UI without locking the backend to one provider.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gap: 18,
            maxWidth: 1080,
            margin: '0 auto',
          }}
        >
          {ECOSYSTEM_GROUPS.map((group) => (
            <div
              key={group.title}
              style={{
                display: 'grid',
                gridTemplateColumns: '170px minmax(0, 1fr)',
                gap: 14,
                alignItems: 'start',
              }}
              className="ecosystem-row"
            >
              <div
                style={{
                  fontFamily: tokens.typography.fontMono,
                  fontSize: 11,
                  lineHeight: 1.5,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: tokens.colors.accent,
                  paddingTop: 16,
                }}
              >
                {group.title}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: 10,
                }}
              >
                {group.items.map((item) => (
                  <EcosystemTile key={`${group.title}-${item.name}`} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <style>{`
          [data-ui="ecosystem-tile"]:hover {
            border-color: ${tokens.colors.accentBorderHover};
            box-shadow: ${tokens.shadows.md};
            transform: translateY(-1px);
          }

          @media (max-width: 760px) {
            .ecosystem-row {
              grid-template-columns: 1fr !important;
              gap: 8px !important;
            }
            .ecosystem-row > div:first-child {
              padding-top: 0 !important;
            }
          }

          @media (prefers-reduced-motion: reduce) {
            [data-ui="ecosystem-tile"]:hover {
              transform: none;
            }
          }
        `}</style>
      </Container>
    </Section>
  );
}
