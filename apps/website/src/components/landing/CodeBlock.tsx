import { codeToHtml } from 'shiki';
import { tokens } from '@ngaf/design-tokens';

const EXAMPLE = `// app.config.ts
provideAgent({ apiUrl: 'http://localhost:2024' })

// chat.component.ts
const chat = agent<{ messages: BaseMessage[] }>({
  assistantId: 'chat_agent',
  threadId: signal(this.threadId),
  onThreadId: (id) => localStorage.setItem('threadId', id),
});`;

const TEMPLATE_EXAMPLE = `<!-- chat.component.html -->
@for (msg of chat.messages(); track $index) {
  <p>{{ msg.content }}</p>
}
<button (click)="chat.submit({ messages: [input] })">Send</button>`;

export async function CodeBlock() {
  const tsHtml = await codeToHtml(EXAMPLE, {
    lang: 'typescript',
    theme: 'tokyo-night',
  });

  const templateHtml = await codeToHtml(TEMPLATE_EXAMPLE, {
    lang: 'html',
    theme: 'tokyo-night',
  });

  return (
    <section className="px-8 py-16 max-w-4xl mx-auto animate-on-scroll">
      <p className="font-mono text-xs uppercase tracking-widest mb-8 text-center"
        style={{ color: tokens.colors.accent }}>30-second example</p>
      <div style={{
        borderRadius: 12,
        border: `1px solid ${tokens.glass.border}`,
        boxShadow: tokens.glass.shadow,
        overflow: 'hidden',
      }}>
        <div
          className="overflow-hidden text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: tsHtml }}
        />
        <div
          className="overflow-hidden text-sm leading-relaxed"
          style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
          dangerouslySetInnerHTML={{ __html: templateHtml }}
        />
      </div>
    </section>
  );
}
