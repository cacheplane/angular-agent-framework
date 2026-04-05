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
  it('returns gray for pending', () => {
    expect(statusColor('pending')).toContain('gray');
  });

  it('returns blue for running', () => {
    expect(statusColor('running')).toContain('blue');
  });

  it('returns green for complete', () => {
    expect(statusColor('complete')).toContain('green');
  });

  it('returns red for error', () => {
    expect(statusColor('error')).toContain('red');
  });
});
