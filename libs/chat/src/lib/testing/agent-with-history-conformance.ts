// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import type { AgentWithHistory, AgentCheckpoint } from '../agent';
import { runAgentConformance } from './agent-conformance';

/**
 * Conformance suite for AgentWithHistory implementations.
 *
 * Runs the base Agent conformance suite, then verifies the history
 * signal is present and returns an array of AgentCheckpoint-shaped entries.
 */
export function runAgentWithHistoryConformance(
  label: string,
  factory: (seed?: { history?: AgentCheckpoint[] }) => AgentWithHistory,
): void {
  runAgentConformance(label, () => factory());

  describe(`${label} — history`, () => {
    it('exposes a history signal', () => {
      const agent = factory();
      expect(typeof agent.history).toBe('function');
      expect(Array.isArray(agent.history())).toBe(true);
    });

    it('reflects seeded checkpoints', () => {
      const seed: AgentCheckpoint[] = [
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
