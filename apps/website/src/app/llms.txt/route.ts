import { NextResponse } from 'next/server';

// Build compact LLMs summary at request time so version is always current
function buildLlmsTxt(): string {
  // Inline version — updated by publish workflow
  const version = '0.1.0';
  return [
    `# Angular Agent Framework v${version}`,
    '',
    "Angular Agent Framework — the enterprise streaming library for LangChain/LangGraph. Provides agent() — full parity with React's useStream() hook, built on Angular Signals.",
    '',
    '## Install',
    'npm install @cacheplane/angular',
    '',
    '## Key API',
    '- agent(options): AgentRef — call in Angular injection context (constructor or field initializer)',
    '- provideAgent(config): Provider — register in app.config.ts for global defaults',
    "- AgentRef.messages(): Signal<BaseMessage[]> — updates token by token",
    '- AgentRef.submit(values): Promise<void> — send a message / trigger a run',
    "- AgentRef.status(): Signal<'idle'|'loading'|'resolved'|'error'>",
    '- AgentRef.threadId signal + onThreadId callback — thread persistence across refreshes',
    '- MockAgentTransport — deterministic unit testing without a real server',
    '',
    '## Minimal example',
    "import { agent } from '@cacheplane/angular';",
    "const chat = agent({ assistantId: 'chat_agent', apiUrl: 'http://localhost:2024' });",
    '// Template: @for (msg of chat.messages(); track $index) { <p>{{ msg.content }}</p> }',
    "// Submit: chat.submit({ messages: [{ role: 'human', content: input }] })",
    '',
    '## MCP server',
    'npx @cacheplane/angular-mcp',
    '',
    '## Full reference',
    'https://cacheplane.ai/llms-full.txt',
  ].join('\n');
}

export async function GET() {
  return new NextResponse(buildLlmsTxt(), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
