// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { stepSelection, type Direction } from './timeline-inspector.component';

describe('stepSelection', () => {
  it('moves down when not at end', () => {
    expect(stepSelection('down', 0, 3)).toBe(1);
  });

  it('does not move past last index', () => {
    expect(stepSelection('down', 2, 3)).toBe(2);
  });

  it('moves up when not at start', () => {
    expect(stepSelection('up', 2, 3)).toBe(1);
  });

  it('does not move below 0', () => {
    expect(stepSelection('up', 0, 3)).toBe(0);
  });

  it('jumps to start', () => {
    expect(stepSelection('home', 5, 10)).toBe(0);
  });

  it('jumps to end', () => {
    expect(stepSelection('end', 0, 4)).toBe(3);
  });

  it('returns -1 when count is 0', () => {
    expect(stepSelection('down', -1, 0)).toBe(-1);
    expect(stepSelection('end', -1, 0)).toBe(-1);
  });
});
