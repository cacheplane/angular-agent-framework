import { createAgentRef } from '@threadplane/chat';

/**
 * Parent graph state for the subgraphs example.
 *
 * `research_topic` and `research_brief` are the two keys the parent shares
 * with the compiled child graph — writing a topic is what routes execution
 * into the subgraph, and the brief is what comes back out. The child's own
 * state has no `messages` key, which is why nothing it produces reaches the
 * transcript.
 */
export interface SubgraphsState {
  messages: unknown[];
  research_topic: string;
  research_brief: string;
}

/**
 * Typed DI handle for the subgraphs agent.
 * Wire with `provideAgent(SUBGRAPHS_AGENT, () => ...)` and inject with
 * `injectAgent(SUBGRAPHS_AGENT)` to get `LangGraphAgent<SubgraphsState>`.
 */
export const SUBGRAPHS_AGENT = createAgentRef<SubgraphsState>('subgraphs');
