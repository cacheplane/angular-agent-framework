// libs/ag-ui/src/lib/testing/fake-agent.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  AbstractAgent,
  EventType,
  type BaseEvent,
  type RunAgentInput,
} from '@ag-ui/client';
import { Observable } from 'rxjs';

/**
 * In-process AG-UI agent that emits a canned streaming response.
 *
 * Use for offline demos and tests where a real backend isn't available.
 * Echoes a fixed assistant reply token-by-token with realistic timing.
 *
 * NOT for production use.
 */
export class FakeAgent extends AbstractAgent {
  /**
   * Tokens streamed back as the assistant reply. Override with custom
   * tokens via the constructor for varied demo content.
   */
  private readonly tokens: string[];

  /** Milliseconds between successive token emissions. */
  private readonly delayMs: number;

  constructor(opts: { tokens?: string[]; delayMs?: number } = {}) {
    super();
    this.tokens = opts.tokens ?? [
      'Hello', ' from', ' the', ' fake', ' AG-UI', ' agent.',
      ' This', ' is', ' a', ' canned', ' streaming', ' reply.',
    ];
    this.delayMs = opts.delayMs ?? 60;
  }

  run(input: RunAgentInput): Observable<BaseEvent> {
    const tokens = this.tokens;
    const delayMs = this.delayMs;
    const messageId = `fake-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const sequence: BaseEvent[] = [
      { type: EventType.RUN_STARTED, threadId: input.threadId, runId: input.runId } as BaseEvent,
      { type: EventType.TEXT_MESSAGE_START, messageId, role: 'assistant' } as BaseEvent,
      ...tokens.map((delta) => (
        { type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta } as BaseEvent
      )),
      { type: EventType.TEXT_MESSAGE_END, messageId } as BaseEvent,
      { type: EventType.RUN_FINISHED, threadId: input.threadId, runId: input.runId } as BaseEvent,
    ];

    return new Observable<BaseEvent>((observer) => {
      let cancelled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let i = 0;

      const emitNext = () => {
        if (cancelled) return;
        if (i >= sequence.length) {
          observer.complete();
          return;
        }
        observer.next(sequence[i]);
        i++;
        // Steady cadence except a tiny initial delay before RUN_STARTED.
        timer = setTimeout(emitNext, delayMs);
      };

      timer = setTimeout(emitNext, 30);

      return () => {
        cancelled = true;
        if (timer !== undefined) clearTimeout(timer);
      };
    });
  }
}
