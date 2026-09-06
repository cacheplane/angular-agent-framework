import { expect, it } from 'vitest';
import { parsePilotArguments } from '../scripts/research-pilot.mts';

it('rejects the retired baseline execution approach', () => {
  expect(() =>
    parsePilotArguments([
      'run',
      '--output',
      '/tmp/pilot',
      '--corpus',
      'x',
      '--approach',
      'baseline',
    ])
  ).toThrow('pilot_invalid_arguments');
  expect(
    parsePilotArguments(['synthetic', '--output', '/tmp/pilot'])
  ).toMatchObject({ command: 'synthetic' });
});

it('accepts only bounded operator commands with explicit output directory', () => {
  expect(
    parsePilotArguments([
      'run',
      '--output',
      '/tmp/pilot',
      '--corpus',
      '/tmp/corpus.json',
      '--approach',
      'agent',
    ])
  ).toMatchObject({ command: 'run', output: '/tmp/pilot', approach: 'agent' });
  expect(() =>
    parsePilotArguments([
      'run',
      '--output',
      '/tmp/pilot',
      '--corpus',
      'x',
      '--approach',
      'random',
    ])
  ).toThrow();
  expect(() =>
    parsePilotArguments(['run', '--corpus', 'x', '--approach', 'agent'])
  ).toThrow();
  expect(() =>
    parsePilotArguments([
      'inspect',
      '--output',
      '/tmp/pilot',
      '--run',
      '../secret',
    ])
  ).toThrow();
  expect(() =>
    parsePilotArguments([
      'synthetic',
      '--output',
      '/tmp/pilot',
      '--output',
      '/another',
    ])
  ).toThrow();
});
