// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { signal, computed, type WritableSignal } from '@angular/core';
import { activeSubagentsFromAgent } from './chat-subagents.component';
import { mockChatAgent } from '../../testing/mock-chat-agent';
import type { ChatSubagent, ChatSubagentStatus } from '../../agent/chat-subagent';

function makeSubagent(toolCallId: string, status: ChatSubagentStatus): ChatSubagent {
  return {
    toolCallId,
    status: signal(status),
    messages: signal([]),
    state: signal({}),
  };
}

describe('activeSubagentsFromAgent()', () => {
  it('returns an empty array when agent does not expose subagents', () => {
    const agent = mockChatAgent(); // no withSubagents
    expect(activeSubagentsFromAgent(agent)).toEqual([]);
  });

  it('returns an empty array when the subagents map is empty', () => {
    const agent = mockChatAgent({ withSubagents: true });
    expect(activeSubagentsFromAgent(agent)).toEqual([]);
  });

  it('includes subagents with status pending or running', () => {
    const agent = mockChatAgent({ withSubagents: true });
    const pending = makeSubagent('tc-1', 'pending');
    const running = makeSubagent('tc-2', 'running');
    (agent.subagents as WritableSignal<Map<string, ChatSubagent>>).set(
      new Map([['tc-1', pending], ['tc-2', running]]),
    );
    const active = activeSubagentsFromAgent(agent);
    expect(active).toHaveLength(2);
    expect(active).toContain(pending);
    expect(active).toContain(running);
  });

  it('excludes subagents with status complete or error', () => {
    const agent = mockChatAgent({ withSubagents: true });
    const complete = makeSubagent('tc-1', 'complete');
    const error    = makeSubagent('tc-2', 'error');
    const running  = makeSubagent('tc-3', 'running');
    (agent.subagents as WritableSignal<Map<string, ChatSubagent>>).set(
      new Map([
        ['tc-1', complete],
        ['tc-2', error],
        ['tc-3', running],
      ]),
    );
    const active = activeSubagentsFromAgent(agent);
    expect(active).toEqual([running]);
  });
});

describe('ChatSubagentsComponent — activeSubagents computed', () => {
  it('reflects the agent map and updates reactively', () => {
    const agent = mockChatAgent({ withSubagents: true });
    const writable = agent.subagents as WritableSignal<Map<string, ChatSubagent>>;
    const running = makeSubagent('tc-1', 'running');

    const agent$ = signal(agent);
    const active = computed(() => activeSubagentsFromAgent(agent$()));

    expect(active()).toHaveLength(0);
    writable.set(new Map([['tc-1', running]]));
    expect(active()).toEqual([running]);
  });
});
