// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import type { ChatAgentWithHistory, ChatCheckpoint } from '../agent';
import { runChatAgentConformance } from './chat-agent-conformance';

/**
 * Conformance suite for ChatAgentWithHistory implementations.
 *
 * Runs the base ChatAgent conformance suite, then verifies the history
 * signal is present and returns an array of ChatCheckpoint-shaped entries.
 */
export function runChatAgentWithHistoryConformance(
  label: string,
  factory: (seed?: { history?: ChatCheckpoint[] }) => ChatAgentWithHistory,
): void {
  runChatAgentConformance(label, () => factory());

  describe(`${label} — history`, () => {
    it('exposes a history signal', () => {
      const agent = factory();
      expect(typeof agent.history).toBe('function');
      expect(Array.isArray(agent.history())).toBe(true);
    });

    it('reflects seeded checkpoints', () => {
      const seed: ChatCheckpoint[] = [
        { id: 'c1', label: 'Step 1', values: { foo: 1 } },
        { id: 'c2', label: 'Step 2', values: { foo: 2 } },
      ];
      const agent = factory({ history: seed });
      const entries = agent.history();
      expect(entries).toHaveLength(2);
      expect(entries[0].id).toBe('c1');
      expect(entries[1].values).toEqual({ foo: 2 });
    });
  });
}
