/**
 * Single source of truth for all cockpit capability examples.
 * Used by serve, build, test, and deploy scripts.
 */
export interface Capability {
  id: string;
  product: 'langgraph' | 'deep-agents' | 'render' | 'chat' | 'ag-ui';
  topic: string;
  angularProject: string;
  port: number;
  pythonPort?: number;
  /** Optional — ag-ui caps run in-process via FakeAgent and have no Python backend. */
  pythonDir?: string;
  /** Optional — see pythonDir. */
  graphName?: string;
}

export const capabilities: readonly Capability[] = [
  { id: 'streaming', product: 'langgraph', topic: 'streaming', angularProject: 'cockpit-langgraph-streaming-angular', port: 4300, pythonPort: 5300, pythonDir: 'cockpit/langgraph/streaming/python', graphName: 'streaming' },
  { id: 'persistence', product: 'langgraph', topic: 'persistence', angularProject: 'cockpit-langgraph-persistence-angular', port: 4301, pythonPort: 5301, pythonDir: 'cockpit/langgraph/persistence/python', graphName: 'persistence' },
  { id: 'interrupts', product: 'langgraph', topic: 'interrupts', angularProject: 'cockpit-langgraph-interrupts-angular', port: 4302, pythonPort: 5302, pythonDir: 'cockpit/langgraph/interrupts/python', graphName: 'interrupts' },
  { id: 'memory', product: 'langgraph', topic: 'memory', angularProject: 'cockpit-langgraph-memory-angular', port: 4303, pythonPort: 5303, pythonDir: 'cockpit/langgraph/memory/python', graphName: 'memory' },
  { id: 'durable-execution', product: 'langgraph', topic: 'durable-execution', angularProject: 'cockpit-langgraph-durable-execution-angular', port: 4304, pythonPort: 5304, pythonDir: 'cockpit/langgraph/durable-execution/python', graphName: 'durable-execution' },
  { id: 'subgraphs', product: 'langgraph', topic: 'subgraphs', angularProject: 'cockpit-langgraph-subgraphs-angular', port: 4305, pythonPort: 5305, pythonDir: 'cockpit/langgraph/subgraphs/python', graphName: 'subgraphs' },
  { id: 'time-travel', product: 'langgraph', topic: 'time-travel', angularProject: 'cockpit-langgraph-time-travel-angular', port: 4306, pythonPort: 5306, pythonDir: 'cockpit/langgraph/time-travel/python', graphName: 'time-travel' },
  { id: 'deployment-runtime', product: 'langgraph', topic: 'deployment-runtime', angularProject: 'cockpit-langgraph-deployment-runtime-angular', port: 4307, pythonPort: 5307, pythonDir: 'cockpit/langgraph/deployment-runtime/python', graphName: 'deployment-runtime' },
  { id: 'da-planning', product: 'deep-agents', topic: 'planning', angularProject: 'cockpit-deep-agents-planning-angular', port: 4310, pythonPort: 5310, pythonDir: 'cockpit/deep-agents/planning/python', graphName: 'da-planning' },
  { id: 'da-filesystem', product: 'deep-agents', topic: 'filesystem', angularProject: 'cockpit-deep-agents-filesystem-angular', port: 4311, pythonPort: 5311, pythonDir: 'cockpit/deep-agents/filesystem/python', graphName: 'da-filesystem' },
  { id: 'da-subagents', product: 'deep-agents', topic: 'subagents', angularProject: 'cockpit-deep-agents-subagents-angular', port: 4312, pythonPort: 5312, pythonDir: 'cockpit/deep-agents/subagents/python', graphName: 'subagents' },
  { id: 'da-memory', product: 'deep-agents', topic: 'memory', angularProject: 'cockpit-deep-agents-memory-angular', port: 4313, pythonPort: 5313, pythonDir: 'cockpit/deep-agents/memory/python', graphName: 'da-memory' },
  { id: 'da-skills', product: 'deep-agents', topic: 'skills', angularProject: 'cockpit-deep-agents-skills-angular', port: 4314, pythonPort: 5314, pythonDir: 'cockpit/deep-agents/skills/python', graphName: 'da-skills' },
  { id: 'da-sandboxes', product: 'deep-agents', topic: 'sandboxes', angularProject: 'cockpit-deep-agents-sandboxes-angular', port: 4315, pythonPort: 5315, pythonDir: 'cockpit/deep-agents/sandboxes/python', graphName: 'da-sandboxes' },
  // Render capabilities
  { id: 'r-spec-rendering', product: 'render', topic: 'spec-rendering', angularProject: 'cockpit-render-spec-rendering-angular', port: 4401, pythonPort: 5401, pythonDir: 'cockpit/render/spec-rendering/python', graphName: 'r-spec-rendering' },
  { id: 'r-element-rendering', product: 'render', topic: 'element-rendering', angularProject: 'cockpit-render-element-rendering-angular', port: 4402, pythonPort: 5402, pythonDir: 'cockpit/render/element-rendering/python', graphName: 'r-element-rendering' },
  { id: 'r-state-management', product: 'render', topic: 'state-management', angularProject: 'cockpit-render-state-management-angular', port: 4403, pythonPort: 5403, pythonDir: 'cockpit/render/state-management/python', graphName: 'r-state-management' },
  { id: 'r-registry', product: 'render', topic: 'registry', angularProject: 'cockpit-render-registry-angular', port: 4404, pythonPort: 5404, pythonDir: 'cockpit/render/registry/python', graphName: 'r-registry' },
  { id: 'r-repeat-loops', product: 'render', topic: 'repeat-loops', angularProject: 'cockpit-render-repeat-loops-angular', port: 4405, pythonPort: 5405, pythonDir: 'cockpit/render/repeat-loops/python', graphName: 'r-repeat-loops' },
  { id: 'r-computed-functions', product: 'render', topic: 'computed-functions', angularProject: 'cockpit-render-computed-functions-angular', port: 4406, pythonPort: 5406, pythonDir: 'cockpit/render/computed-functions/python', graphName: 'r-computed-functions' },
  // Chat capabilities
  { id: 'c-messages', product: 'chat', topic: 'messages', angularProject: 'cockpit-chat-messages-angular', port: 4501, pythonPort: 5501, pythonDir: 'cockpit/chat/messages/python', graphName: 'c-messages' },
  { id: 'c-input', product: 'chat', topic: 'input', angularProject: 'cockpit-chat-input-angular', port: 4502, pythonPort: 5502, pythonDir: 'cockpit/chat/input/python', graphName: 'c-input' },
  { id: 'c-interrupts', product: 'chat', topic: 'interrupts', angularProject: 'cockpit-chat-interrupts-angular', port: 4503, pythonPort: 5503, pythonDir: 'cockpit/chat/interrupts/python', graphName: 'c-interrupts' },
  { id: 'c-tool-calls', product: 'chat', topic: 'tool-calls', angularProject: 'cockpit-chat-tool-calls-angular', port: 4504, pythonPort: 5504, pythonDir: 'cockpit/chat/tool-calls/python', graphName: 'c-tool-calls' },
  { id: 'c-subagents', product: 'chat', topic: 'subagents', angularProject: 'cockpit-chat-subagents-angular', port: 4505, pythonPort: 5505, pythonDir: 'cockpit/chat/subagents/python', graphName: 'c-subagents' },
  { id: 'c-threads', product: 'chat', topic: 'threads', angularProject: 'cockpit-chat-threads-angular', port: 4506, pythonPort: 5506, pythonDir: 'cockpit/chat/threads/python', graphName: 'c-threads' },
  { id: 'c-timeline', product: 'chat', topic: 'timeline', angularProject: 'cockpit-chat-timeline-angular', port: 4507, pythonPort: 5507, pythonDir: 'cockpit/chat/timeline/python', graphName: 'c-timeline' },
  { id: 'c-generative-ui', product: 'chat', topic: 'generative-ui', angularProject: 'cockpit-chat-generative-ui-angular', port: 4508, pythonPort: 5508, pythonDir: 'cockpit/chat/generative-ui/python', graphName: 'c-generative-ui' },
  { id: 'c-debug', product: 'chat', topic: 'debug', angularProject: 'cockpit-chat-debug-angular', port: 4509, pythonPort: 5509, pythonDir: 'cockpit/chat/debug/python', graphName: 'c-debug' },
  { id: 'c-theming', product: 'chat', topic: 'theming', angularProject: 'cockpit-chat-theming-angular', port: 4510, pythonPort: 5510, pythonDir: 'cockpit/chat/theming/python', graphName: 'c-theming' },
  { id: 'c-a2ui', product: 'chat', topic: 'a2ui', angularProject: 'cockpit-chat-a2ui-angular', port: 4511, pythonPort: 5511, pythonDir: 'cockpit/chat/a2ui/python', graphName: 'c-a2ui' },
  // AG-UI capabilities (in-process FakeAgent; no Python backend, not deployed to LangSmith)
  { id: 'ag-ui-streaming', product: 'ag-ui', topic: 'streaming', angularProject: 'cockpit-ag-ui-streaming-angular', port: 4600 },
] as const;

export function findCapability(id: string): Capability | undefined {
  return capabilities.find((c) => c.id === id);
}

export function allAngularProjects(): string[] {
  return capabilities.map((c) => c.angularProject);
}
