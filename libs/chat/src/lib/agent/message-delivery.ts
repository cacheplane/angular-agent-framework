// SPDX-License-Identifier: MIT

/**
 * Terminal result of one response attempt.
 *
 * `paused` is an intentional stop awaiting resumable input; `interrupted` means
 * the response stream ended unexpectedly. The other outcomes indicate normal
 * completion, failure, or caller cancellation.
 */
export type CompleteOutcome = 'success' | 'error' | 'aborted' | 'interrupted' | 'paused';

/**
 * Delivery lifecycle for one response attempt. `generation` identifies that
 * attempt and is stable only for its lifetime. `streaming` means chunks may
 * still arrive; `complete` means the attempt has stopped with a terminal outcome.
 */
export type MessageDelivery =
  | { readonly generation: string; readonly phase: 'streaming' }
  | {
      readonly generation: string;
      readonly phase: 'complete';
      readonly outcome: CompleteOutcome;
    };

export function streamingDelivery(generation: string) {
  return { generation, phase: 'streaming' } as const satisfies MessageDelivery;
}

export function completeDelivery<const TOutcome extends CompleteOutcome>(
  generation: string,
  outcome: TOutcome,
) {
  const delivery = { generation, phase: 'complete', outcome } as const;
  return delivery satisfies MessageDelivery;
}

export function staticDelivery(messageId: string) {
  return completeDelivery(messageId, 'success');
}
