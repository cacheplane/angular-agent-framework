import { describe, it, expect } from 'vitest';
import { Annotation, MessagesAnnotation, StateGraph, END } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { AIMessage, ToolMessage, HumanMessage } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { bindClientTools, clientToolsChannel, clientToolsRouter } from './langgraph';

// A scripted fake chat model exposing the bindTools + invoke surface the graph uses.
class FakeModel {
  bound: unknown[] = [];
  private turn = 0;
  bindTools(tools: unknown[]) { this.bound = tools; return this; }
  async invoke(messages: unknown[]) {
    void messages;
    this.turn += 1;
    if (this.turn === 1) {
      return new AIMessage({ content: '', tool_calls: [{ name: 'get_weather', args: { city: 'SF' }, id: 'call_1' }] });
    }
    return new AIMessage({ content: 'It is 65F in SF.' });
  }
}

const State = Annotation.Root({ ...MessagesAnnotation.spec, ...clientToolsChannel() });

function buildGraph(model: FakeModel) {
  const agent = async (state: typeof State.State) => {
    const bound = bindClientTools(model, [], state);
    const res = await (bound as FakeModel).invoke(state.messages);
    return { messages: [res] };
  };
  return new StateGraph(State)
    .addNode('agent', agent)
    .addEdge('__start__', 'agent')
    .addConditionalEdges('agent', (s) => clientToolsRouter([])(s), [END])
    .compile();
}

describe('client-tools loop (in-process)', () => {
  it('binds the client stub, ends on the client call, then continues after a ToolMessage', async () => {
    const model = new FakeModel();
    const graph = buildGraph(model);
    const tools = [{ name: 'get_weather', description: 'Weather', parameters: { type: 'object' } }];

    const r1 = await graph.invoke({ messages: [new HumanMessage('weather in SF?')], tools });
    const last1 = r1.messages[r1.messages.length - 1] as AIMessage;
    expect(last1.tool_calls?.[0]?.name).toBe('get_weather');
    expect((model.bound[0] as { function: { name: string } }).function.name).toBe('get_weather');

    const r2 = await graph.invoke({
      messages: [...r1.messages, new ToolMessage({ content: '65F', tool_call_id: 'call_1' })],
      tools,
    });
    expect((r2.messages[r2.messages.length - 1] as AIMessage).content).toBe('It is 65F in SF.');
  });
});

describe("the router's default toolsNode", () => {
  it('dispatches a server tool call to a node named by the default, with no override', async () => {
    const echo = tool(async ({ text }: { text: string }) => `echoed:${text}`, {
      name: 'echo',
      description: 'Echo the input.',
      schema: z.object({ text: z.string() }),
    });

    let agentTurns = 0;
    const graph = new StateGraph(State)
      .addNode('agent', async () => {
        agentTurns += 1;
        if (agentTurns > 1) return { messages: [new AIMessage({ content: 'done' })] };
        return {
          messages: [
            new AIMessage({ content: '', tool_calls: [{ name: 'echo', args: { text: 'hi' }, id: 'call_1' }] }),
          ],
        };
      })
      .addNode('server_tools', new ToolNode([echo]))
      .addEdge('__start__', 'agent')
      .addEdge('server_tools', 'agent')
      .addConditionalEdges('agent', (s) => clientToolsRouter(['echo'])(s), ['server_tools', END])
      .compile();

    const result = await graph.invoke({ messages: [new HumanMessage('echo hi')] });
    const toolMessage = result.messages.find((m): m is ToolMessage => m instanceof ToolMessage);
    expect(toolMessage?.content).toBe('echoed:hi');
  });

  it("records why 'tools' cannot be a node name on a client-tools graph", () => {
    // clientToolsChannel() declares a `tools` state channel, and LangGraph JS
    // shares one namespace between channel names and node names — which is why
    // the router's default destination is 'server_tools', not 'tools'.
    expect(() => new StateGraph(State).addNode('tools', async () => ({ messages: [] }))).toThrow(
      /tools is already being used as a state attribute/,
    );
  });
});
