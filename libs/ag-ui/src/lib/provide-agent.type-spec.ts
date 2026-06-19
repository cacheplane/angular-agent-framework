// SPDX-License-Identifier: MIT
import { createAgentRef } from '@threadplane/chat';
import type { Equal, Expect } from '../testing/type-assert';
import { injectAgent } from './provide-agent';
import type { AgUiAgent } from './to-agent';

interface TripState { day: number; places: string[]; }
const TRIP = createAgentRef<TripState>('trip');
declare function ctx<T>(fn: () => T): T;

const typed = ctx(() => injectAgent(TRIP));
type _state = Expect<Equal<ReturnType<typeof typed.state>, TripState>>;
type _isAgUi = Expect<Equal<typeof typed, AgUiAgent<TripState>>>;

const plain = ctx(() => injectAgent());
type _plainState = Expect<Equal<ReturnType<typeof plain.state>, Record<string, unknown>>>;
