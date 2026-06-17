// SPDX-License-Identifier: MIT
/**
 * LangGraph client-tools graph (LangGraph.js / TypeScript path).
 *
 * The JS twin of `../python/src/graph.py`. The browser declares the tools
 * (get_weather / weather_card / confirm_booking) and the `@threadplane/langgraph`
 * adapter ships the catalog as `input.client_tools`. This graph declares the
 * client-tools state channels so the catalog is retained across the turn, binds
 * those client stubs onto the model (no server implementation), and ends the
 * turn when the model calls one — the browser executes it and re-runs with a
 * ToolMessage, which the model then summarizes.
 *
 * The bind/route logic comes entirely from `@threadplane/middleware/langgraph`.
 */
import { ChatOpenAI } from '@langchain/openai';
import { Annotation, MessagesAnnotation, StateGraph, END } from '@langchain/langgraph';
import { SystemMessage } from '@langchain/core/messages';
import {
  bindClientTools,
  clientToolsChannel,
  clientToolsRouter,
} from '@threadplane/middleware/langgraph';

// `clientToolsChannel()` declares the `tools` (primary) and `client_tools`
// (fallback) channels. The @threadplane/langgraph adapter ships the catalog as
// `client_tools`; bindClientTools reads `tools` then falls back to it.
const State = Annotation.Root({
  ...MessagesAnnotation.spec,
  ...clientToolsChannel(),
});

// Inlined so the graph has no filesystem/ESM-path dependency under langgraphjs dev.
const SYSTEM_PROMPT = `# Client Tools Assistant

You are a demo assistant showing browser-executed tools over LangGraph. You have
three client tools — call the right one and do not answer in prose first:

- When the user asks about the weather for a place, call \`get_weather\` with the
  location. After it returns, give a one-sentence summary using the data.
- When the user asks to *show* or *display* a weather card, call \`weather_card\`
  with the location and plausible readings (temperatureF, conditions, humidity,
  windMph). After it renders, briefly confirm.
- When the user asks to book or reserve something, call \`confirm_booking\` with a
  one-line \`summary\` of what they're booking. After the user responds, confirm
  if they accepted or acknowledge if they cancelled.

Keep replies to one short sentence; the components carry the detail.`;

const baseLlm = new ChatOpenAI({ model: 'gpt-5-mini', streaming: true });

function buildClientToolsGraph() {
  const agent = async (state: typeof State.State) => {
    // bindClientTools reads state.tools then falls back to state.client_tools.
    const llm = bindClientTools(baseLlm, [], state);
    const response = await llm.invoke([new SystemMessage(SYSTEM_PROMPT), ...state.messages]);
    return { messages: [response] };
  };

  // No server tools: a client tool call ends the run (the browser executes it),
  // and so does a final text turn. clientToolsRouter([]) routes both to END.
  return new StateGraph(State)
    .addNode('agent', agent)
    .addEdge('__start__', 'agent')
    .addConditionalEdges('agent', clientToolsRouter([]), [END])
    .compile();
}

// The graph instance referenced by langgraph.json. For `langgraphjs dev` the
// platform runtime provides the checkpointer, so we compile without one
// (mirrors the Python graph).
export const graph = buildClientToolsGraph();
