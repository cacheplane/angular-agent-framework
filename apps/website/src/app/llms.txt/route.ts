import { NextResponse } from 'next/server';

// Build compact LLMs summary at request time so version is always current
function buildLlmsTxt(): string {
  // Inline version — updated by publish workflow
  const version = '0.1.0';
  return [
    `# Angular Stream Resource v${version}`,
    '',
    "Angular Stream Resource — the enterprise streaming library for LangChain/LangGraph. Provides streamResource() — full parity with React's useStream() hook, built on Angular Signals.",
    '',
    '## Install',
    'npm install @cacheplane/stream-resource',
    '',
    '## Key API',
    '- streamResource(options): StreamResourceRef — call in Angular injection context (constructor or field initializer)',
    '- provideStreamResource(config): Provider — register in app.config.ts for global defaults',
    "- StreamResourceRef.messages(): Signal<BaseMessage[]> — updates token by token",
    '- StreamResourceRef.submit(values): Promise<void> — send a message / trigger a run',
    "- StreamResourceRef.status(): Signal<'idle'|'loading'|'resolved'|'error'>",
    '- StreamResourceRef.threadId signal + onThreadId callback — thread persistence across refreshes',
    '- MockStreamTransport — deterministic unit testing without a real server',
    '',
    '## Minimal example',
    "import { streamResource } from '@cacheplane/stream-resource';",
    "const chat = streamResource({ assistantId: 'chat_agent', apiUrl: 'http://localhost:2024' });",
    '// Template: @for (msg of chat.messages(); track $index) { <p>{{ msg.content }}</p> }',
    "// Submit: chat.submit({ messages: [{ role: 'human', content: input }] })",
    '',
    '## MCP server',
    'npx @cacheplane/stream-resource-mcp',
    '',
    '## Full reference',
    'https://stream-resource.dev/llms-full.txt',
  ].join('\n');
}

export async function GET() {
  return new NextResponse(buildLlmsTxt(), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
