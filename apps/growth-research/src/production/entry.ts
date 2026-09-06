import { Annotation, StateGraph, START, END } from '@langchain/langgraph';
import { createClaimStore } from './claims.js';
import { createCompanyExecutor } from './executor.js';
import type { CompanyRequest, CompanyResult } from './contracts.js';
import { configuredTraceSink } from './tracing.js';

const State = Annotation.Root({
  request: Annotation<CompanyRequest>(),
  result: Annotation<CompanyResult>(),
});
const execute = createCompanyExecutor({
  claims: createClaimStore(),
  telemetry: configuredTraceSink,
});
// Private Agent Server authentication owns the HTTP boundary. No caller-provided
// context/config can enable the independent server-owned production mode gate.
export const graph = new StateGraph(State)
  .addNode(
    'runCompany',
    async (state, config) => ({
      result: await execute(state.request, config.signal),
    }),
    { retryPolicy: { maxAttempts: 1 } }
  )
  .addEdge(START, 'runCompany')
  .addEdge('runCompany', END)
  .compile();
