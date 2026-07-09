// SPDX-License-Identifier: MIT
import type { Agent } from '@threadplane/chat';
import { createAgentRef } from '@threadplane/chat';
import { makeFakeSignalChatResource } from '../testing/fake-signal-chat-resource';
import type { Equal, Expect } from '../testing/type-assert';
import { injectAgent, provideAgent } from './provide-agent';

interface TripState {
  day: number;
  places: string[];
}

const TRIP = createAgentRef<TripState>('trip');
const fixture = makeFakeSignalChatResource();

declare function ctx<T>(fn: () => T): T;

const typed = ctx(() => injectAgent(TRIP));
export type TypedAgentCheck = Expect<Equal<typeof typed, Agent<TripState>>>;
export type TypedStateCheck = Expect<Equal<ReturnType<typeof typed.state>, TripState>>;

const plain = ctx(() => injectAgent());
export type PlainAgentCheck = Expect<Equal<typeof plain, Agent<Record<string, unknown>>>>;
export type PlainStateCheck = Expect<Equal<ReturnType<typeof plain.state>, Record<string, unknown>>>;

void typed;
void plain;

provideAgent(TRIP, fixture.resource);
provideAgent(TRIP, () => fixture.resource);
provideAgent(fixture.resource);
provideAgent(() => fixture.resource);
