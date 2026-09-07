import type { BaseEvent } from '@ag-ui/client';
import type { Equal, Expect } from '../../testing/type-assert';
import type { FakeAgentScript } from './fake-agent';
import { provideFakeAgent, type AgUiFakeAgentConfig } from './provide-fake-agent';

// `script` is part of the accepted config, not constructor-only: an object
// literal carrying it must not trip excess-property checking.
provideFakeAgent({
  tokens: ['hi'],
  delayMs: 0,
  script: [
    {
      when: 'initial',
      events: [
        { type: 'TOOL_CALL_START', toolCallId: 't1', toolCallName: 'search' } as BaseEvent,
      ],
    },
    {
      when: { toolMessageFor: 't1' },
      events: [{ type: 'TEXT_MESSAGE_START', messageId: 'm1' } as BaseEvent],
    },
  ],
});

// The shared fields survive, and `script` reaches the constructor's own type.
type _script = Expect<Equal<AgUiFakeAgentConfig['script'], FakeAgentScript | undefined>>;
type _tokens = Expect<Equal<AgUiFakeAgentConfig['tokens'], string[] | undefined>>;
type _when = Expect<
  Equal<FakeAgentScript[number]['when'], 'initial' | { toolMessageFor: string }>
>;
