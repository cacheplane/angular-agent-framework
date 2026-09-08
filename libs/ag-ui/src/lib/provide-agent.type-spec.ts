import { createAgentRef, type Agent } from '@threadplane/chat';
import type { Equal, Expect } from '../testing/type-assert';
import { injectAgent } from './provide-agent';
import type { AgUiAgent } from './to-agent';
import type { AgUiSubmitOptions } from '../public-api';

interface TripState { day: number; places: string[]; }
const TRIP = createAgentRef<TripState>('trip');
declare function ctx<T>(fn: () => T): T;

const typed = ctx(() => injectAgent(TRIP));
type _state = Expect<Equal<ReturnType<typeof typed.state>, TripState>>;
type _isAgUi = Expect<Equal<typeof typed, AgUiAgent<TripState>>>;

const plain = ctx(() => injectAgent());
type _plainState = Expect<Equal<ReturnType<typeof plain.state>, Record<string, unknown>>>;

const resumeOptions: AgUiSubmitOptions = { interruptGeneration: 2, signal: new AbortController().signal };
typed.submit({ resume: true }, resumeOptions);
const neutral: Agent<TripState> = typed;
neutral.submit({ resume: true }, { signal: new AbortController().signal });
// @ts-expect-error The adapter generation is numeric.
typed.submit({ resume: true }, { interruptGeneration: '2' });
