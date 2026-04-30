// SPDX-License-Identifier: MIT
const PATTERNS: Record<string, string> = {
  localStorage: `// Thread persistence with localStorage
threadId = signal<string | null>(localStorage.getItem('chat-thread-id'));

chat = agent({
  assistantId: 'chat_agent',
  threadId: this.threadId,
  onThreadId: (id: string) => {
    this.threadId.set(id);
    localStorage.setItem('chat-thread-id', id);
  },
});

// To start a new conversation:
// this.threadId.set(null); localStorage.removeItem('chat-thread-id');`,

  sessionStorage: `// Thread persistence with sessionStorage (clears on tab close)
threadId = signal<string | null>(sessionStorage.getItem('chat-thread-id'));

chat = agent({
  assistantId: 'chat_agent',
  threadId: this.threadId,
  onThreadId: (id: string) => {
    this.threadId.set(id);
    sessionStorage.setItem('chat-thread-id', id);
  },
});`,

  custom: `// Thread persistence with a custom store
// TODO: replace saveThread / loadThread with your store (e.g. NgRx, a service, IndexedDB)
threadId = signal<string | null>(loadThread());

chat = agent({
  assistantId: 'chat_agent',
  threadId: this.threadId,
  onThreadId: (id: string) => {
    this.threadId.set(id);
    saveThread(id); // TODO: replace with your store
  },
});`,
};

export const getThreadPersistencePatternTool = {
  name: 'get_thread_persistence_pattern',
  description: 'Get Angular code pattern for thread persistence with a specific storage type',
  inputSchema: {
    type: 'object',
    properties: {
      storageType: {
        type: 'string',
        enum: ['localStorage', 'sessionStorage', 'custom'],
        description: 'Storage mechanism to use',
      },
    },
    required: ['storageType'],
  },
};

export function handleGetThreadPersistencePattern(args: Record<string, unknown>) {
  const storageType = args['storageType'] as string;
  const pattern = PATTERNS[storageType];
  if (!pattern) {
    return { content: [{ type: 'text', text: `Unknown storageType: "${storageType}". Use: localStorage, sessionStorage, or custom` }] };
  }
  return { content: [{ type: 'text', text: `\`\`\`typescript\n${pattern}\n\`\`\`` }] };
}
