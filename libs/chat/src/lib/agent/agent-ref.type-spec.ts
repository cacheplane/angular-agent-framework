// SPDX-License-Identifier: MIT
import type { InjectionToken } from '@angular/core';
import type { Equal, Expect } from '../../testing/type-assert';
import type { Agent } from './agent';
import { createAgentRef, type AgentRef } from './agent-ref';

interface TripState { day: number; places: string[]; }

const trip = createAgentRef<TripState>('trip');
type _refTyped = Expect<Equal<typeof trip, AgentRef<TripState>>>;
type _tokenTyped = Expect<Equal<typeof trip.token, InjectionToken<Agent<TripState>>>>;

// default state when no param.
type _default = Expect<Equal<Agent['state'], import('@angular/core').Signal<unknown>>>;
