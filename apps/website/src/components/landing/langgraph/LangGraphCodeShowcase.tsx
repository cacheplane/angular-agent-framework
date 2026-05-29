import { tokens } from '@threadplane/design-tokens';
import { HighlightedCode } from '../HighlightedCode';

const SNIPPET_1 = `// app.config.ts
import { provideAgent } from '@threadplane/langgraph';

providers: [
  provideAgent({
    assistantId: 'my-agent',
    apiUrl: 'https://my-langgraph.cloud',
  }),
];

// component
import { injectAgent } from '@threadplane/langgraph';
const chat = injectAgent();

// Reactive signals — OnPush compatible
chat.messages();    // Signal<Message[]>
chat.isLoading();   // Signal<boolean>
chat.interrupt();   // Signal<AgentInterrupt | undefined>`;

const SNIPPET_2 = `// app.config.ts
import { provideAgent, MockAgentTransport, FetchStreamTransport } from '@threadplane/langgraph';

providers: [
  provideAgent({
    apiUrl: environment.langgraphUrl,
    assistantId: 'my-agent',
    threadId: savedThreadId,
    onThreadId: (id) => localStorage.setItem('threadId', id),
    transport: isTest
      ? new MockAgentTransport(fixtures)
      : new FetchStreamTransport(),
  }),
];

// component
import { injectAgent } from '@threadplane/langgraph';
const chat = injectAgent();`;

const SNIPPETS = [
  { title: 'Minimal Setup', code: SNIPPET_1, lang: 'typescript' },
  { title: 'Full Configuration', code: SNIPPET_2, lang: 'typescript' },
];

export async function LangGraphCodeShowcase() {
  return (
    <section className="angular-code" style={{ padding: '80px 32px' }}>
      <style>{`@media (max-width: 767px) { .angular-code { padding: 60px 20px !important; } }`}</style>
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <p style={{
          fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
          fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.12em',
          fontWeight: 700, color: tokens.colors.accent, marginBottom: 14,
        }}>
          Developer Experience
        </p>
        <h2 style={{
          fontFamily: 'var(--font-garamond,"EB Garamond",Georgia,serif)',
          fontSize: 'clamp(26px,3.5vw,42px)', fontWeight: 800, lineHeight: 1.1,
          color: tokens.colors.textPrimary,
        }}>
          Production streaming in a few lines
        </h2>
      </div>

      <div style={{
        maxWidth: 900, margin: '0 auto',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(380px, 100%), 1fr))', gap: 24,
      }}>
        {SNIPPETS.map((s) => (
          <div
            key={s.title}
            style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${tokens.surfaces.border}` }}
          >
            <div style={{
              padding: '10px 20px', background: 'rgba(0,64,144,0.04)',
              borderBottom: `1px solid ${tokens.surfaces.border}`,
            }}>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: '0.68rem',
                fontWeight: 700, color: tokens.colors.accent,
              }}>
                {s.title}
              </span>
            </div>
            <HighlightedCode code={s.code} lang={s.lang} />
          </div>
        ))}
      </div>
    </section>
  );
}
