// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { ChatSubagentCardComponent, statusColor } from './chat-subagent-card.component';

describe('ChatSubagentCardComponent', () => {
  it('is defined', () => {
    expect(ChatSubagentCardComponent).toBeDefined();
    expect(typeof ChatSubagentCardComponent).toBe('function');
  });
});

describe('statusColor', () => {
  it('returns muted style for pending', () => {
    expect(statusColor('pending')).toContain('var(--chat-text-muted)');
  });

  it('returns warning style for running', () => {
    expect(statusColor('running')).toContain('var(--chat-warning-text)');
  });

  it('returns success style for complete', () => {
    expect(statusColor('complete')).toContain('var(--chat-success)');
  });

  it('returns error style for error', () => {
    expect(statusColor('error')).toContain('var(--chat-error-text)');
  });
});
