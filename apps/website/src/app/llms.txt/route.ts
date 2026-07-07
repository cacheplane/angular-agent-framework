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
    `# Threadplane v${version}`,
    '',
    "Threadplane is a runtime-neutral chat UI SDK for Angular. The @threadplane/chat library provides streaming chat primitives bound to a runtime-neutral 'Agent' contract; runtime adapters (@threadplane/langgraph, @threadplane/ag-ui) translate between the contract and the actual backend.",
    '',
    '## Packages',
    '- @threadplane/chat — chat UI primitives (messages, input, tool calls, interrupt, debug, etc.) consuming the Agent contract',
    '- @threadplane/langgraph — adapter for LangGraph / LangGraph Platform',
    '- @threadplane/ag-ui — adapter for any AG-UI-compatible backend (CrewAI, Mastra, Microsoft AF, AG2, Pydantic AI, AWS Strands, CopilotKit runtime)',
    '- @threadplane/render — generative UI runtime (Vercel json-render + Google A2UI)',
    '- @threadplane/a2ui — protocol types, JSONL parser, dynamic value resolver, and pointer helpers for A2UI streams',
    '- @threadplane/middleware — backend LangGraph helpers for browser-executed client tools',
    '- @threadplane/licensing — offline license verification and non-blocking package check helpers',
    '- @threadplane/telemetry — browser, Node, and shared telemetry helpers with privacy controls',
    '',
    '## Install',
    '# LangGraph backend:',
    'npm install @threadplane/chat @threadplane/langgraph @langchain/core @langchain/langgraph-sdk marked',
    '# LangGraph backend with browser client tools:',
    'npm install @threadplane/chat @threadplane/langgraph @langchain/core @langchain/langgraph-sdk @threadplane/middleware marked',
    '# AG-UI backend:',
    'npm install @threadplane/chat @threadplane/ag-ui @ag-ui/client @ag-ui/core marked',
    '',
    '## Key API (symmetric across adapters)',
    '- provideAgent(config) — wires the adapter into Angular DI. Same name across @threadplane/langgraph and @threadplane/ag-ui.',
    '- injectAgent() — no-args helper that returns the configured Agent from DI. Identical call shape across adapters.',
    '- AgentConfig — type for the provideAgent config (adapter-specific fields).',
    '- LangGraphAgent — unified type exposed by @threadplane/langgraph; signals for messages/status/isLoading/error/toolCalls/history + submit/stop methods.',
    '- ChatComponent, ChatMessageListComponent, ChatInputComponent — composable Angular components consuming the runtime-neutral Agent contract.',
    '- mockLangGraphAgent — testing utility with a writable signal-backed LangGraphAgent.',
    '- runAgentConformance / runAgentWithHistoryConformance — conformance suites for adapter authors.',
    '',
    '## Minimal LangGraph example',
    "import { provideAgent, injectAgent } from '@threadplane/langgraph';",
    "import { ChatComponent } from '@threadplane/chat';",
    "// app.config.ts: providers: [provideAgent({ apiUrl: 'http://localhost:2024', assistantId: 'chat' })]",
    '// Component: agent = injectAgent();',
    '// Template: <chat [agent]="agent" />',
    '',
    '## Minimal AG-UI example',
    "import { provideAgent, injectAgent } from '@threadplane/ag-ui';",
    "import { ChatComponent } from '@threadplane/chat';",
    "// app.config.ts: providers: [provideAgent({ url: 'https://your.endpoint' })]",
    '// Component: agent = injectAgent();',
    '// Template: <chat [agent]="agent" />',
    '',
    '## License',
    'Most packages are MIT. @threadplane/chat is free for noncommercial/evaluation use and commercially licensed for production use.',
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
