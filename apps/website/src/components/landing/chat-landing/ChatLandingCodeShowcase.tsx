import { tokens } from '@ngaf/design-tokens';
import { HighlightedCode } from '../HighlightedCode';

const SNIPPET_1 = `import { ChatComponent } from '@ngaf/chat';

@Component({
  template: \`
    <chat
      [agent]="agent"
      [registry]="registry"
    />
  \`,
})
export class MyChatPage {
  agent = inject(AgentRef);
  registry = inject(RenderRegistry);
}`;

const SNIPPET_2 = `chat {
  --chat-bg: #f8f9fc;
  --chat-user-bg: #004090;
  --chat-user-color: #ffffff;
  --chat-assistant-bg: #f0f4ff;
  --chat-font-family: 'Inter', sans-serif;
  --chat-border-radius: 12px;
  --chat-input-border: 1px solid #e4e4e7;
}`;

const SNIPPETS = [
  { title: 'Prebuilt Chat', code: SNIPPET_1, lang: 'typescript' },
  { title: 'Custom Theming', code: SNIPPET_2, lang: 'css' },
];

export async function ChatLandingCodeShowcase() {
  return (
    <section className="chat-code" style={{ padding: '80px 32px' }}>
      <style>{`@media (max-width: 767px) { .chat-code { padding: 60px 20px !important; } }`}</style>
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <p style={{
          fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
          fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.12em',
          fontWeight: 700, color: tokens.colors.chatPurple, marginBottom: 14,
        }}>
          Developer Experience
        </p>
        <h2 style={{
          fontFamily: 'var(--font-garamond,"EB Garamond",Georgia,serif)',
          fontSize: 'clamp(26px,3.5vw,42px)', fontWeight: 800, lineHeight: 1.1,
          color: tokens.colors.textPrimary,
        }}>
          Full-featured chat in a few lines
        </h2>
      </div>

      <div style={{
        maxWidth: 900, margin: '0 auto',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(380px, 100%), 1fr))', gap: 24,
      }}>
        {SNIPPETS.map((s) => (
          <div
            key={s.title}
            style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${tokens.glass.border}` }}
          >
            <div style={{
              padding: '10px 20px', background: 'rgba(90,0,200,0.04)',
              borderBottom: `1px solid ${tokens.glass.border}`,
            }}>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: '0.68rem',
                fontWeight: 700, color: tokens.colors.chatPurple,
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
