// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { Annotation, MessagesAnnotation, StateGraph, END } from '@langchain/langgraph';
import { AIMessage, ToolMessage, HumanMessage } from '@langchain/core/messages';
import { bindClientTools, clientToolsChannel, clientToolsRouter } from './langgraph';

// A scripted fake chat model exposing the bindTools + invoke surface the graph uses.
class FakeModel {
  bound: unknown[] = [];
  private turn = 0;
  bindTools(tools: unknown[]) { this.bound = tools; return this; }
  async invoke(_messages: unknown[]) {
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
