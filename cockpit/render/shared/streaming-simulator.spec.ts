import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { StreamingSimulator } from './streaming-simulator';

const SIMPLE_SPEC = JSON.stringify({
  root: 'root',
  elements: {
    root: { type: 'Text', props: { content: 'Hello' } },
  },
});

describe('StreamingSimulator', () => {
  let simulator: StreamingSimulator;

  beforeEach(() => {
    globalThis.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 0) as unknown as number);
    globalThis.cancelAnimationFrame = vi.fn((id) => clearTimeout(id));
    simulator = new StreamingSimulator(SIMPLE_SPEC);
  });

  afterEach(() => {
    simulator.destroy();
  });

  it('initializes with position 0 and total equal to source length', () => {
    expect(simulator.position()).toBe(0);
    expect(simulator.total()).toBe(SIMPLE_SPEC.length);
    expect(simulator.playing()).toBe(false);
    expect(simulator.speed()).toBe(1);
    expect(simulator.spec()).toBeNull();
    expect(simulator.rawJson()).toBe('');
  });

  it('seek parses from 0 to the given position and materializes', () => {
    simulator.seek(SIMPLE_SPEC.length);
    expect(simulator.position()).toBe(SIMPLE_SPEC.length);
    expect(simulator.spec()).not.toBeNull();
    expect(simulator.spec()?.root).toBe('root');
    expect(simulator.rawJson()).toBe(SIMPLE_SPEC);
  });

  it('seek to partial position produces partial raw json', () => {
    simulator.seek(10);
    expect(simulator.position()).toBe(10);
    expect(simulator.rawJson()).toBe(SIMPLE_SPEC.slice(0, 10));
  });

  it('seek backwards re-parses from 0', () => {
    simulator.seek(SIMPLE_SPEC.length);
    simulator.seek(5);
    expect(simulator.position()).toBe(5);
    expect(simulator.rawJson()).toBe(SIMPLE_SPEC.slice(0, 5));
  });

  it('setSource resets to new source', () => {
    const newSpec = JSON.stringify({ root: 'r', elements: {} });
    simulator.setSource(newSpec);
    expect(simulator.total()).toBe(newSpec.length);
    expect(simulator.position()).toBe(0);
    expect(simulator.spec()).toBeNull();
  });

  it('toggle switches playing state', () => {
    expect(simulator.playing()).toBe(false);
    simulator.toggle();
    expect(simulator.playing()).toBe(true);
    simulator.toggle();
    expect(simulator.playing()).toBe(false);
  });

  it('setSpeed updates speed', () => {
    simulator.setSpeed(4);
    expect(simulator.speed()).toBe(4);
  });

  it('progress returns fraction', () => {
    expect(simulator.progress()).toBe(0);
    simulator.seek(SIMPLE_SPEC.length);
    expect(simulator.progress()).toBe(1);
  });
});
