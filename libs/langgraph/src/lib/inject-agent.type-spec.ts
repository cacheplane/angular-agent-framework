// SPDX-License-Identifier: MIT
import { createAgentRef } from '@threadplane/chat';
import type { Equal, Expect } from '../testing/type-assert';
import { injectAgent } from './inject-agent';

interface TripState { day: number; places: string[]; }
const TRIP = createAgentRef<TripState>('trip');

declare function ctx<T>(fn: () => T): T;

// injectAgent(ref) is typed LangGraphAgent<TripState>; state and value are Signal<TripState>.
const typed = ctx(() => injectAgent(TRIP));
type _agentState = Expect<Equal<ReturnType<typeof typed.state>, TripState>>;
type _agentValue = Expect<Equal<ReturnType<typeof typed.value>, TripState>>;

// no-arg form stays valid (default state).
const plain = ctx(() => injectAgent());
type _plainState = Expect<Equal<ReturnType<typeof plain.state>, Record<string, unknown>>>;
