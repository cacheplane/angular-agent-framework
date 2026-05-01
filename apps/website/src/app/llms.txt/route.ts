import { NextResponse } from 'next/server';

// Build compact LLMs summary at request time so version is always current
function buildLlmsTxt(): string {
  // Inline version — bump on each release
  const version = '0.0.1';
  return [
    `# Angular Agent Framework v${version}`,
    '',
    "Angular Agent Framework is a runtime-neutral chat UI SDK for Angular. The @ngaf/chat library provides streaming chat primitives bound to a runtime-neutral 'Agent' contract; runtime adapters (@ngaf/langgraph, @ngaf/ag-ui) translate between the contract and the actual backend.",
    '',
    '## Packages',
    '- @ngaf/chat — chat UI primitives (messages, input, tool calls, interrupt, debug, etc.) consuming the Agent contract',
    '- @ngaf/langgraph — adapter for LangGraph / LangGraph Platform',
    '- @ngaf/ag-ui — adapter for any AG-UI-compatible backend (CrewAI, Mastra, Microsoft AF, AG2, Pydantic AI, AWS Strands, CopilotKit runtime)',
    '- @ngaf/render — generative UI runtime (Vercel json-render + Google A2UI)',
    '- @ngaf/a2ui — A2UI catalog components',
    '- @ngaf/partial-json — streaming JSON parser',
    '- @ngaf/licensing — license verification client',
    '',
    '## Install',
    '# LangGraph backend:',
    'npm install @ngaf/chat @ngaf/langgraph',
    '# AG-UI backend:',
    'npm install @ngaf/chat @ngaf/ag-ui',
    '',
    '## Key API',
    '- LangGraphAgent — unified type returned by agent(); exposes messages/status/isLoading/error/toolCalls/history signals + submit/stop methods',
    '- agent({ apiUrl, assistantId }) — single call that creates and returns a LangGraphAgent; no toAgent() step needed',
    '- ChatComponent, ChatMessagesComponent, ChatInputComponent — composable Angular components consuming LangGraphAgent',
    '- mockLangGraphAgent — testing utility with a writable signal-backed LangGraphAgent',
    '- runAgentConformance / runAgentWithHistoryConformance — conformance suites for adapter authors',
    '',
    '## Minimal LangGraph example',
    "import { agent } from '@ngaf/langgraph';",
    "import { ChatComponent } from '@ngaf/chat';",
    '// In a component:',
    "chat = agent({ apiUrl: 'http://localhost:2024', assistantId: 'chat_agent' });",
    '// Template: <chat [ref]="chat" />',
    '',
    '## Minimal AG-UI example',
    "import { provideAgUiAgent, AG_UI_AGENT } from '@ngaf/ag-ui';",
    "import { ChatComponent } from '@ngaf/chat';",
    "// app.config.ts: providers: [provideAgUiAgent({ url: 'https://your.endpoint' })]",
    "// Component: agent = inject(AG_UI_AGENT);",
    '// Template: <chat [agent]="agent" />',
    '',
    '## License',
    'MIT — free for any use, commercial or noncommercial.',
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
