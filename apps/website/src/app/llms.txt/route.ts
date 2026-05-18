import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function loadVersion(): string {
  const candidates = [
    path.join(process.cwd(), 'libs', 'langgraph', 'package.json'),
    path.join(process.cwd(), '..', '..', 'libs', 'langgraph', 'package.json'),
  ];
  const packagePath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!packagePath) return '0.0.0';
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8')) as { version?: string };
  return packageJson.version ?? '0.0.0';
}

function buildLlmsTxt(): string {
  const version = loadVersion();
  return [
    `# Agent UI for Angular v${version}`,
    '',
    "Agent UI for Angular is a runtime-neutral chat UI SDK for Angular. The @ngaf/chat library provides streaming chat primitives bound to a runtime-neutral 'Agent' contract; runtime adapters (@ngaf/langgraph, @ngaf/ag-ui) translate between the contract and the actual backend.",
    '',
    '## Packages',
    '- @ngaf/chat — chat UI primitives (messages, input, tool calls, interrupt, debug, etc.) consuming the Agent contract',
    '- @ngaf/langgraph — adapter for LangGraph / LangGraph Platform',
    '- @ngaf/ag-ui — adapter for any AG-UI-compatible backend (CrewAI, Mastra, Microsoft AF, AG2, Pydantic AI, AWS Strands, CopilotKit runtime)',
    '- @ngaf/render — generative UI runtime (Vercel json-render + Google A2UI)',
    '- @ngaf/a2ui — protocol types, JSONL parser, dynamic value resolver, and pointer helpers for A2UI streams',
    '- @ngaf/licensing — offline license verification and non-blocking package check helpers',
    '- @ngaf/telemetry — browser, Node, and shared telemetry helpers with privacy controls',
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
    '- ChatComponent, ChatMessageListComponent, ChatInputComponent — composable Angular components consuming the runtime-neutral Agent contract',
    '- mockLangGraphAgent — testing utility with a writable signal-backed LangGraphAgent',
    '- runAgentConformance / runAgentWithHistoryConformance — conformance suites for adapter authors',
    '',
    '## Minimal LangGraph example',
    "import { agent } from '@ngaf/langgraph';",
    "import { ChatComponent } from '@ngaf/chat';",
    '// In a component:',
    "chat = agent({ apiUrl: 'http://localhost:2024', assistantId: 'chat' });",
    '// Template: <chat [agent]="chat" />',
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
    'https://threadplane.ai/llms-full.txt',
  ].join('\n');
}

export async function GET() {
  return new NextResponse(buildLlmsTxt(), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
