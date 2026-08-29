import { HighlightedCode } from '../HighlightedCode';

const SNIPPET_1 = `import { injectAgent, provideAgent } from '@threadplane/langgraph';
import { ChatComponent, a2uiBasicCatalog } from '@threadplane/chat';

@Component({
  imports: [ChatComponent],
  providers: [
    provideAgent({ apiUrl: 'http://localhost:2024', assistantId: 'chat_agent' }),
  ],
  template: \`
    <chat
      [agent]="agent"
      [views]="views"
    />
  \`,
})
export class MyChatPage {
  protected readonly agent = injectAgent();
  protected readonly views = a2uiBasicCatalog();
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
    <section className="chat-code">
      <div className="chat-show-intro">
        <p className="chat-show-eyebrow">
          Developer Experience
        </p>
        <h2 className="chat-show-heading">
          Full-featured chat in a few lines
        </h2>
      </div>

      <div className="chat-show-grid">
        {SNIPPETS.map((s) => (
          <div key={s.title} className="chat-show-card">
            <div className="chat-show-card-head">
              <span className="chat-show-card-title">
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
