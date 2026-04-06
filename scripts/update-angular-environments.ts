#!/usr/bin/env npx tsx
/**
 * Update all Angular production environment.ts files with LangGraph Cloud URLs
 * from deployment-urls.json.
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const root = resolve(__dirname, '..');
const urls: Record<string, string> = JSON.parse(
  readFileSync(resolve(root, 'deployment-urls.json'), 'utf-8'),
);

const capabilities = [
  { dir: 'cockpit/langgraph/streaming/angular', assistantId: 'streaming', field: 'streamingAssistantId' },
  { dir: 'cockpit/langgraph/persistence/angular', assistantId: 'persistence', field: 'streamingAssistantId' },
  { dir: 'cockpit/langgraph/interrupts/angular', assistantId: 'interrupts', field: 'streamingAssistantId' },
  { dir: 'cockpit/langgraph/memory/angular', assistantId: 'memory', field: 'streamingAssistantId' },
  { dir: 'cockpit/langgraph/durable-execution/angular', assistantId: 'durable-execution', field: 'streamingAssistantId' },
  { dir: 'cockpit/langgraph/subgraphs/angular', assistantId: 'subgraphs', field: 'streamingAssistantId' },
  { dir: 'cockpit/langgraph/time-travel/angular', assistantId: 'time-travel', field: 'streamingAssistantId' },
  { dir: 'cockpit/langgraph/deployment-runtime/angular', assistantId: 'deployment-runtime', field: 'deploymentRuntimeAssistantId' },
  { dir: 'cockpit/deep-agents/planning/angular', assistantId: 'planning', field: 'streamingAssistantId' },
  { dir: 'cockpit/deep-agents/filesystem/angular', assistantId: 'filesystem', field: 'streamingAssistantId' },
  { dir: 'cockpit/deep-agents/subagents/angular', assistantId: 'subagents', field: 'streamingAssistantId' },
  { dir: 'cockpit/deep-agents/memory/angular', assistantId: 'da-memory', field: 'streamingAssistantId' },
  { dir: 'cockpit/deep-agents/skills/angular', assistantId: 'skills', field: 'streamingAssistantId' },
  { dir: 'cockpit/deep-agents/sandboxes/angular', assistantId: 'sandboxes', field: 'streamingAssistantId' },
];

for (const cap of capabilities) {
  const url = urls[cap.assistantId];
  if (!url || url === 'PENDING_DEPLOYMENT') {
    console.log(`⏭️  ${cap.assistantId}: skipped (pending deployment)`);
    continue;
  }

  const envPath = resolve(root, cap.dir, 'src/environments/environment.ts');
  const content = `/**
 * Production environment configuration.
 *
 * Points to the LangGraph Cloud deployment managed by LangSmith.
 * The assistantId must match the graph name in langgraph.json.
 */
export const environment = {
  production: true,
  langGraphApiUrl: '${url}',
  ${cap.field}: '${cap.assistantId}',
};
`;

  writeFileSync(envPath, content);
  console.log(`✅ ${cap.assistantId}: ${envPath}`);
}
