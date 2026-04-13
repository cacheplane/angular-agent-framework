#!/usr/bin/env npx tsx
/**
 * Update all Angular production environment.ts files with LangGraph Cloud URLs
 * from deployment-urls.json.
 *
 * The registry may map every active capability to the same shared deployment
 * URL while the final shared LangSmith deployment is being finalized.
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
  { dir: 'cockpit/chat/messages/angular', assistantId: 'c-messages', urlKey: 'streaming', field: 'streamingAssistantId' },
  { dir: 'cockpit/chat/input/angular', assistantId: 'c-input', urlKey: 'streaming', field: 'streamingAssistantId' },
  { dir: 'cockpit/chat/interrupts/angular', assistantId: 'c-interrupts', urlKey: 'streaming', field: 'streamingAssistantId' },
  { dir: 'cockpit/chat/tool-calls/angular', assistantId: 'c-tool-calls', urlKey: 'streaming', field: 'streamingAssistantId' },
  { dir: 'cockpit/chat/subagents/angular', assistantId: 'c-subagents', urlKey: 'streaming', field: 'streamingAssistantId' },
  { dir: 'cockpit/chat/threads/angular', assistantId: 'c-threads', urlKey: 'streaming', field: 'streamingAssistantId' },
  { dir: 'cockpit/chat/timeline/angular', assistantId: 'c-timeline', urlKey: 'streaming', field: 'streamingAssistantId' },
  { dir: 'cockpit/chat/generative-ui/angular', assistantId: 'c-generative-ui', urlKey: 'streaming', field: 'generativeUiAssistantId' },
  { dir: 'cockpit/chat/debug/angular', assistantId: 'c-debug', urlKey: 'streaming', field: 'streamingAssistantId' },
  { dir: 'cockpit/chat/theming/angular', assistantId: 'c-theming', urlKey: 'streaming', field: 'streamingAssistantId' },
  { dir: 'cockpit/chat/a2ui/angular', assistantId: 'c-a2ui', urlKey: 'streaming', field: 'a2uiAssistantId' },
];

function isPendingUrl(url: string): boolean {
  return url === 'PENDING_DEPLOYMENT' || url.includes('placeholder');
}

for (const cap of capabilities) {
  const url = urls[cap.urlKey ?? cap.assistantId];
  if (!url) {
    console.log(`⏭️  ${cap.assistantId}: skipped (missing deployment URL)`);
    continue;
  }
  if (isPendingUrl(url)) {
    console.log(`⏭️  ${cap.assistantId}: skipped (${url})`);
    continue;
  }

  const envPath = resolve(root, cap.dir, 'src/environments/environment.ts');
  const content = `/**
 * Production environment configuration.
 *
 * Points to the LangGraph Cloud deployment managed by LangSmith.
 * All active capability files may legitimately share the same deployment URL.
 * The assistantId must still match the graph name in langgraph.json.
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
