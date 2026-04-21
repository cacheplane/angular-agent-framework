// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { ChatAgent } from '../agent';

/**
 * Runs a suite of contract conformance assertions against a factory that
 * produces a fresh ChatAgent. Adapter packages should call this in their
 * own test suites to verify the contract is satisfied.
 */
export function runChatAgentConformance(
  label: string,
  factory: () => ChatAgent,
): void {
  describe(`${label} — ChatAgent conformance`, () => {
    it('exposes required core signals', () => {
      const a = factory();
      expect(typeof a.messages).toBe('function');
      expect(typeof a.status).toBe('function');
      expect(typeof a.isLoading).toBe('function');
      expect(typeof a.error).toBe('function');
      expect(typeof a.toolCalls).toBe('function');
      expect(typeof a.state).toBe('function');
    });

    it('messages() returns an array', () => {
      expect(Array.isArray(factory().messages())).toBe(true);
    });

    it('toolCalls() returns an array', () => {
      expect(Array.isArray(factory().toolCalls())).toBe(true);
    });

    it('state() returns a plain object', () => {
      const v = factory().state();
      expect(typeof v).toBe('object');
      expect(v).not.toBeNull();
    });

    it('status() returns one of the allowed values', () => {
      expect(['idle', 'running', 'error']).toContain(factory().status());
    });

    it('isLoading() is true only when status === "running"', () => {
      const a = factory();
      if (a.isLoading()) {
        expect(a.status()).toBe('running');
      }
    });

    it('submit() returns a Promise', () => {
      const result = factory().submit({ message: 'test' });
      expect(result).toBeInstanceOf(Promise);
    });

    it('stop() returns a Promise', () => {
      const result = factory().stop();
      expect(result).toBeInstanceOf(Promise);
    });

    it('if customEvents$ is present, it is an Observable-like with .subscribe', () => {
      const agent = factory();
      if (agent.customEvents$ !== undefined) {
        expect(typeof agent.customEvents$.subscribe).toBe('function');
      } else {
        expect(agent.customEvents$).toBeUndefined();
      }
    });
  });
}
