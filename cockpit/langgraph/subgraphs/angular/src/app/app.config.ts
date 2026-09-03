import { injectCockpitRuntimeConnection } from '@threadplane/cockpit-telemetry';
import { ApplicationConfig } from '@angular/core';
import { provideAgent } from '@threadplane/langgraph';
import { provideChat } from '@threadplane/chat';
import { SUBGRAPHS_AGENT } from './agent-ref';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAgent(SUBGRAPHS_AGENT, () => {
      const connection = injectCockpitRuntimeConnection();
      if (connection.adapter !== 'langgraph') {
        throw new Error('incompatible runtime');
      }
      return {
        apiUrl: connection.apiUrl,
        assistantId: connection.assistantId,
        clientOptions: connection.clientOptions,
        // Only the parent's `answer` node writes the user-facing turn.
        //
        // This is load-bearing, and its failure mode is mid-stream rather than
        // final-state. LangGraph emits the child's tokens under a
        // `research:<uuid>` namespace, and that namespace is NOT a subagent
        // namespace (`tools:`), so the bridge merges those tokens into the
        // transcript as they arrive. Verified against a live model: without
        // this option the message list transiently grows to 3 — the child's
        // internal brief renders as its own chat bubble — before the parent's
        // authoritative `values` event collapses it back to 2. Because the end
        // state self-corrects, a final-state e2e assertion cannot catch it.
        transcriptNodeNames: ['answer'],
      };
    }),
    provideChat({}),
  ],
};
