// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
export const scaffoldChatComponentTool = {
  name: 'scaffold_chat_component',
  description: 'Generate a complete Angular chat component using angular',
  inputSchema: {
    type: 'object',
    properties: {
      componentName: { type: 'string', description: 'Component class name, e.g. "ChatComponent"' },
      apiUrl: { type: 'string', description: 'LangGraph server URL' },
      assistantId: { type: 'string', description: 'LangGraph assistant/graph ID' },
      threadPersistence: { type: 'boolean', description: 'Include localStorage thread persistence' },
    },
    required: ['componentName', 'apiUrl', 'assistantId', 'threadPersistence'],
  },
};

export function handleScaffoldChatComponent(args: Record<string, unknown>) {
  const { componentName, apiUrl, assistantId, threadPersistence } = args as {
    componentName: string; apiUrl: string; assistantId: string; threadPersistence: boolean;
  };

  const selector = componentName.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
  const persistenceImport = threadPersistence ? ', signal' : '';
  const persistenceFields = threadPersistence
    ? `\n  threadId = signal<string | null>(localStorage.getItem('${selector}-thread'));`
    : '';
  const persistenceOptions = threadPersistence
    ? `\n    threadId: this.threadId,\n    onThreadId: (id: string) => {\n      this.threadId.set(id);\n      localStorage.setItem('${selector}-thread', id);\n    },`
    : '';

  const code = `import { Component${persistenceImport} } from '@angular/core';
import { agent } from '@cacheplane/langgraph';
import type { BaseMessage } from '@langchain/core/messages';

@Component({
  selector: 'app-${selector}',
  template: \`
    <div class="messages">
      @for (msg of chat.messages(); track $index) {
        <div class="message" [class.ai]="msg.getType() === 'ai'">
          {{ msg.content }}
        </div>
      }
      @if (chat.isLoading()) {
        <div class="loading">Thinking…</div>
      }
    </div>
    <form (submit)="send($event)">
      <input #input type="text" placeholder="Type a message…" />
      <button type="submit">Send</button>
    </form>
  \`,
})
export class ${componentName} {${persistenceFields}

  chat = agent<{ messages: BaseMessage[] }>({
    apiUrl: '${apiUrl}',
    assistantId: '${assistantId}',${persistenceOptions}
  });

  send(e: Event) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const input = form.querySelector('input') as HTMLInputElement;
    const content = input.value.trim();
    if (!content) return;
    input.value = '';
    this.chat.submit({ messages: [{ role: 'human', content }] } as any);
  }
}`;

  return { content: [{ type: 'text', text: `\`\`\`typescript\n${code}\n\`\`\`` }] };
}
