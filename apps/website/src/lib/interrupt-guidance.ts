/** Shared interrupt guidance served by both machine-readable reference routes. */
export const INTERRUPT_GUIDANCE = [
  '## Interrupts and recovery',
  '',
  'Both adapters expose interrupt() and submit({ resume }); the backend defines the decision payload.',
  'AG-UI auto transport prefers native interrupt batches. Answer every native ID exactly once using { interruptId, status, payload }; cancelled entries must omit payload.',
  'For the Mastra integration, configure interruptTransport: "mastra-command". The adapter sends forwardedProps.command.resume plus command.interruptEvent with observed toolCallId and runId when available. Reject the campsite proposal with { approved: false }.',
  'The LangGraph AG-UI bridge uses forwardedProps.command.resume; the native LangGraph adapter uses its SDK command path. Shared UI does not imply identical persistence APIs.',
  'AG-UI persistence is opt-in: supply a stable threadId, scoped namespace, and application-owned store with atomic compareAndSwap. Await agent.ready before showing restored controls.',
  'Capture interruptSession().generation when rendering a decision and pass it as the interruptGeneration submit option to reject stale controls.',
  'A proven requestNotDispatched failure permits retry() of the retained decision. Uncertain delivery requires authoritative reconciliation through persistence.reconcile and agent.reconcileInterrupt(); do not blindly resend.',
  'ready, interruptSession, reconcileInterrupt, and persistence are AG-UI extensions, not guarantees of the neutral Agent contract. Client storage cannot recreate a lost backend checkpoint or guarantee exactly-once side effects.',
  'Closing an approval card or stopping local streaming does not prove backend cancellation or completion. Verify the backend outcome and the visible reply.',
].join('\n');
