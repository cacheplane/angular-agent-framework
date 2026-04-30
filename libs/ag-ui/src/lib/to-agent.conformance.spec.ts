// SPDX-License-Identifier: MIT
import { Observable } from 'rxjs';
import type { AbstractAgent, BaseEvent } from '@ag-ui/client';
import type { RunAgentInput } from '@ag-ui/core';
import { runAgentConformance } from '@cacheplane/chat';
import { toAgent } from './to-agent';

/**
 * Minimal stub that satisfies the AbstractAgent shape for conformance testing.
 * Implements all methods that toAgent() calls: subscribe(), runAgent(),
 * abortRun(), addMessage(), and the abstract run() method.
 */
class StubAgent {
  private readonly _subscribers: Array<{
    onEvent?: (p: { event: BaseEvent }) => void;
    onRunFailed?: (p: { error: Error }) => void;
  }> = [];

  subscribe(sub: {
    onEvent?: (p: { event: BaseEvent }) => void;
    onRunFailed?: (p: { error: Error }) => void;
  }) {
    this._subscribers.push(sub);
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return { unsubscribe: () => {} };
  }

  async runAgent() {
    return { result: undefined, newMessages: [] };
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  abortRun() {}

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  addMessage(_msg: unknown) {}

  run(_input: RunAgentInput): Observable<BaseEvent> {
    return new Observable();
  }
}

runAgentConformance('toAgent (AG-UI adapter)', () => {
  return toAgent(new StubAgent() as unknown as AbstractAgent);
});
