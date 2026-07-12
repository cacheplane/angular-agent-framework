// SPDX-License-Identifier: MIT
import type { Equal, Expect } from '../../testing/type-assert';
import {
  completeDelivery,
  staticDelivery,
  streamingDelivery,
  type MessageDelivery,
} from './message-delivery';

type TerminalOutcome = 'success' | 'error' | 'aborted' | 'interrupted' | 'paused';

// @ts-expect-error A complete delivery requires a terminal outcome.
const _missingOutcome: MessageDelivery = { generation: 'generation-1', phase: 'complete' };

const streamingState: MessageDelivery = {
  generation: 'generation-2',
  phase: 'streaming',
};
// @ts-expect-error Streaming delivery does not expose an outcome.
streamingState.outcome;

type _completeParameters = Expect<
  Equal<Parameters<typeof completeDelivery>, [generation: string, outcome: TerminalOutcome]>
>;

const streaming = streamingDelivery('generation-3');
const _streamingDelivery: MessageDelivery = streaming;
type _streamingShape = Expect<
  Equal<
    typeof streaming,
    { readonly generation: string; readonly phase: 'streaming' }
  >
>;

const complete = completeDelivery('generation-4', 'paused');
const _completeDelivery: MessageDelivery = complete;

const staticMessage = staticDelivery('message-1');
const _staticDelivery: MessageDelivery = staticMessage;
type _staticShape = Expect<
  Equal<
    typeof staticMessage,
    {
      readonly generation: string;
      readonly phase: 'complete';
      readonly outcome: 'success';
    }
  >
>;

export { _completeDelivery, _staticDelivery, _streamingDelivery };
