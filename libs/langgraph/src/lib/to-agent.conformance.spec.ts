// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { TestBed } from '@angular/core/testing';
import { runAgentConformance } from '@cacheplane/chat';
import { toAgent } from './to-agent';
import { signal } from '@angular/core';
import { ResourceStatus } from './agent.types';
import type { AgentRef } from './agent.types';

/* eslint-disable @typescript-eslint/no-empty-function */
function minimalRef(): AgentRef<unknown, any> {
  return {
    value:           signal<unknown>({}),
    status:          signal<ResourceStatus>(ResourceStatus.Idle),
    isLoading:       signal(false),
    error:           signal<unknown>(null),
    hasValue:        signal(false),
    reload:          () => {},
    messages:        signal([]),
    interrupt:       signal(undefined),
    interrupts:      signal([]),
    toolProgress:    signal([]),
    toolCalls:       signal([]),
    branch:          signal(''),
    history:         signal([]),
    isThreadLoading: signal(false),
    subagents:       signal(new Map()),
    activeSubagents: signal([]),
    customEvents:    signal([]),
    submit:          async () => {},
    stop:            async () => {},
    switchThread:    () => {},
    joinStream:      async () => {},
    setBranch:       () => {},
    getMessagesMetadata: () => undefined,
    getToolCalls:    () => [],
  } as AgentRef<unknown, any>;
}

runAgentConformance('toAgent', () => {
  let agent!: ReturnType<typeof toAgent>;
  TestBed.runInInjectionContext(() => {
    agent = toAgent(minimalRef());
  });
  return agent;
});
