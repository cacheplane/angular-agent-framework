/**
 * Single source of truth for all cockpit capability examples.
 * Used by serve, build, test, and deploy scripts.
 */
export interface Capability {
  id: string;
  product: 'langgraph' | 'deep-agents';
  topic: string;
  angularProject: string;
  port: number;
  pythonDir: string;
  graphName: string;
}

export const capabilities: readonly Capability[] = [
  { id: 'streaming', product: 'langgraph', topic: 'streaming', angularProject: 'cockpit-langgraph-streaming-angular', port: 4300, pythonDir: 'cockpit/langgraph/streaming/python', graphName: 'streaming' },
  { id: 'persistence', product: 'langgraph', topic: 'persistence', angularProject: 'cockpit-langgraph-persistence-angular', port: 4301, pythonDir: 'cockpit/langgraph/persistence/python', graphName: 'persistence' },
  { id: 'interrupts', product: 'langgraph', topic: 'interrupts', angularProject: 'cockpit-langgraph-interrupts-angular', port: 4302, pythonDir: 'cockpit/langgraph/interrupts/python', graphName: 'interrupts' },
  { id: 'memory', product: 'langgraph', topic: 'memory', angularProject: 'cockpit-langgraph-memory-angular', port: 4303, pythonDir: 'cockpit/langgraph/memory/python', graphName: 'memory' },
  { id: 'durable-execution', product: 'langgraph', topic: 'durable-execution', angularProject: 'cockpit-langgraph-durable-execution-angular', port: 4304, pythonDir: 'cockpit/langgraph/durable-execution/python', graphName: 'durable-execution' },
  { id: 'subgraphs', product: 'langgraph', topic: 'subgraphs', angularProject: 'cockpit-langgraph-subgraphs-angular', port: 4305, pythonDir: 'cockpit/langgraph/subgraphs/python', graphName: 'subgraphs' },
  { id: 'time-travel', product: 'langgraph', topic: 'time-travel', angularProject: 'cockpit-langgraph-time-travel-angular', port: 4306, pythonDir: 'cockpit/langgraph/time-travel/python', graphName: 'time-travel' },
  { id: 'deployment-runtime', product: 'langgraph', topic: 'deployment-runtime', angularProject: 'cockpit-langgraph-deployment-runtime-angular', port: 4307, pythonDir: 'cockpit/langgraph/deployment-runtime/python', graphName: 'deployment-runtime' },
  { id: 'planning', product: 'deep-agents', topic: 'planning', angularProject: 'cockpit-deep-agents-planning-angular', port: 4310, pythonDir: 'cockpit/deep-agents/planning/python', graphName: 'planning' },
  { id: 'filesystem', product: 'deep-agents', topic: 'filesystem', angularProject: 'cockpit-deep-agents-filesystem-angular', port: 4311, pythonDir: 'cockpit/deep-agents/filesystem/python', graphName: 'filesystem' },
  { id: 'da-subagents', product: 'deep-agents', topic: 'subagents', angularProject: 'cockpit-deep-agents-subagents-angular', port: 4312, pythonDir: 'cockpit/deep-agents/subagents/python', graphName: 'da-subagents' },
  { id: 'da-memory', product: 'deep-agents', topic: 'memory', angularProject: 'cockpit-deep-agents-memory-angular', port: 4313, pythonDir: 'cockpit/deep-agents/memory/python', graphName: 'da-memory' },
  { id: 'skills', product: 'deep-agents', topic: 'skills', angularProject: 'cockpit-deep-agents-skills-angular', port: 4314, pythonDir: 'cockpit/deep-agents/skills/python', graphName: 'skills' },
  { id: 'sandboxes', product: 'deep-agents', topic: 'sandboxes', angularProject: 'cockpit-deep-agents-sandboxes-angular', port: 4315, pythonDir: 'cockpit/deep-agents/sandboxes/python', graphName: 'sandboxes' },
] as const;

export function findCapability(id: string): Capability | undefined {
  return capabilities.find((c) => c.id === id);
}

export function allAngularProjects(): string[] {
  return capabilities.map((c) => c.angularProject);
}
