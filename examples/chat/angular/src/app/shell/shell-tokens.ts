// SPDX-License-Identifier: MIT
import { InjectionToken } from '@angular/core';
import type { LangGraphAgent } from '@threadplane/langgraph';

/**
 * Shared agent provided by `DemoShell` and consumed by routed mode
 * components. Created once per shell mount; survives mode navigations
 * because the router never unmounts the shell.
 */
export const DEMO_AGENT = new InjectionToken<LangGraphAgent>('DEMO_AGENT');
