// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
const EXAMPLES: Record<string, string> = {
  'basic-chat': `// Basic chat component with angular
import { Component } from '@angular/core';
import { agent } from '@cacheplane/langgraph';
import type { BaseMessage } from '@langchain/core/messages';

@Component({
  selector: 'app-chat',
  template: \`
    @for (msg of chat.messages(); track $index) {
      <p [class.ai]="msg.getType() === 'ai'">{{ msg.content }}</p>
    }
    @if (chat.isLoading()) { <p>Thinking…</p> }
    <input #input type="text" />
    <button (click)="send(input.value); input.value = ''">Send</button>
  \`,
})
export class ChatComponent {
  chat = agent<{ messages: BaseMessage[] }>({ assistantId: 'chat_agent' });
  send(content: string) {
    if (!content.trim()) return;
    this.chat.submit({ messages: [{ role: 'human', content }] } as any);
  }
}`,

  'thread-persistence': `// Thread persistence with localStorage
import { Component, signal } from '@angular/core';
import { agent } from '@cacheplane/langgraph';
import type { BaseMessage } from '@langchain/core/messages';

@Component({ selector: 'app-chat', template: '' })
export class ChatComponent {
  threadId = signal<string | null>(localStorage.getItem('chat-thread'));
  chat = agent<{ messages: BaseMessage[] }>({
    assistantId: 'chat_agent',
    threadId: this.threadId,
    onThreadId: (id) => { this.threadId.set(id); localStorage.setItem('chat-thread', id); },
  });
  newThread() { this.threadId.set(null); localStorage.removeItem('chat-thread'); }
}`,

  'system-prompt': `// System prompt configuration per session
import { Component } from '@angular/core';
import { agent } from '@cacheplane/langgraph';

@Component({ selector: 'app-chat', template: '' })
export class ChatComponent {
  chat = agent({
    assistantId: 'chat_agent',
    config: { configurable: { system_prompt: 'You are a helpful coding assistant.' } },
  });
}`,

  'mock-testing': `// Unit testing with MockAgentTransport
import { TestBed } from '@angular/core/testing';
import { agent, MockAgentTransport } from '@cacheplane/langgraph';
import type { BaseMessage } from '@langchain/core/messages';

describe('ChatComponent', () => {
  it('updates messages when transport emits', () => {
    TestBed.runInInjectionContext(() => {
      const transport = new MockAgentTransport();
      const chat = agent<{ messages: BaseMessage[] }>({ assistantId: 'test', transport });
      transport.emit([
        { type: 'messages', messages: [[{ type: 'ai', content: 'Hello!' }, { id: '1' }]] },
      ]);
      expect(chat.messages()).toHaveLength(1);
      expect(chat.messages()[0].content).toBe('Hello!');
    });
  });
});`,

  'interrupts': `// Handling interrupts (human-in-the-loop)
import { Component } from '@angular/core';
import { agent } from '@cacheplane/langgraph';

@Component({
  selector: 'app-chat',
  template: \`
    @if (chat.interrupt(); as interrupt) {
      <div class="interrupt">
        <p>{{ interrupt.value }}</p>
        <button (click)="approve()">Approve</button>
        <button (click)="reject()">Reject</button>
      </div>
    }
  \`,
})
export class ChatComponent {
  chat = agent({ assistantId: 'agent_with_interrupts' });
  approve() { this.chat.submit(null, { command: { resume: true } }); }
  reject()  { this.chat.submit(null, { command: { resume: false } }); }
}`,

  'subagent-progress': `// Showing subagent tool call progress
import { Component } from '@angular/core';
import { agent } from '@cacheplane/langgraph';

@Component({
  selector: 'app-chat',
  template: \`
    @for (tool of chat.toolProgress(); track tool.name) {
      <p>{{ tool.name }}: {{ tool.status }}</p>
    }
  \`,
})
export class ChatComponent {
  chat = agent({ assistantId: 'research_agent' });
}`,

  'custom-transport': `// Custom transport with auth headers
import { AgentTransport } from '@cacheplane/langgraph';

export class AuthTransport implements AgentTransport {
  async *stream(input: unknown, _options: unknown): AsyncGenerator<unknown> {
    const token = await getAuthToken(); // your auth logic
    const res = await fetch('/api/stream', {
      method: 'POST',
      headers: { Authorization: \`Bearer \${token}\`, 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\\n');
      buffer = lines.pop()!;
      for (const line of lines) {
        if (line.startsWith('data: ')) yield JSON.parse(line.slice(6));
      }
    }
  }
}`,
};

const VALID_PATTERNS = Object.keys(EXAMPLES);

export const getExampleTool = {
  name: 'get_example',
  description: 'Get a complete runnable code example for a angular pattern',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: `Pattern name. One of: ${VALID_PATTERNS.join(', ')}`,
      },
    },
    required: ['pattern'],
  },
};

export function handleGetExample(args: Record<string, unknown>) {
  const pattern = args['pattern'] as string;
  const example = EXAMPLES[pattern];
  if (!example) {
    return { content: [{ type: 'text', text: `Unknown pattern: "${pattern}". Available: ${VALID_PATTERNS.join(', ')}` }] };
  }
  return { content: [{ type: 'text', text: `\`\`\`typescript\n${example}\n\`\`\`` }] };
}
