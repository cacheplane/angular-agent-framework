// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';

import {
  BLOCKED_PUBLIC_CLAIMS,
  assertPublicDocOutput,
  projectPublicDocEntries,
} from './public-doc-projection';

/**
 * The generator reads TSDoc straight out of the libraries, so a claim written
 * in a doc comment becomes published copy without anyone reviewing it as copy.
 * This projection is the boundary: names, types, and structure pass through
 * untouched, and only the barred sentences are dropped.
 */
const entries = () => [
  {
    kind: 'interface',
    name: 'AgentConfig',
    description: 'Runtime configuration for the agent.',
    examples: ['const config: AgentConfig = { url };'],
    properties: [
      { name: 'url', type: 'string', description: 'Endpoint URL.' },
      {
        name: 'telemetry',
        type: 'false | AgentRuntimeTelemetrySink',
        description:
          'Optional app-owned telemetry sink. No telemetry is emitted unless this is provided.',
        optional: true,
      },
    ],
  },
  {
    kind: 'interface',
    name: 'AgentRuntimeTelemetrySink',
    description: 'Sink that receives runtime lifecycle events.',
    properties: [{ name: 'emit', type: '(event) => void' }],
  },
];

describe('projectPublicDocEntries', () => {
  it('keeps the entry, property, and type names the API actually uses', () => {
    const projected = projectPublicDocEntries(entries());

    expect(projected.map((entry) => entry.name)).toEqual([
      'AgentConfig',
      'AgentRuntimeTelemetrySink',
    ]);
    const config = projected[0] as { properties: { name: string; type: string }[] };
    expect(config.properties.map((property) => property.name)).toEqual([
      'url',
      'telemetry',
    ]);
    expect(config.properties[1].type).toBe('false | AgentRuntimeTelemetrySink');
  });

  it('drops only the barred sentence from a description', () => {
    const projected = projectPublicDocEntries(entries());
    const config = projected[0] as {
      properties: { description?: string }[];
    };

    expect(config.properties[1].description).toBe(
      'Optional app-owned telemetry sink.'
    );
  });

  it('leaves unrelated descriptions and examples exactly as written', () => {
    const projected = projectPublicDocEntries(entries());
    const config = projected[0] as {
      description: string;
      examples: string[];
      properties: { description?: string }[];
    };

    expect(config.description).toBe('Runtime configuration for the agent.');
    expect(config.examples).toEqual(['const config: AgentConfig = { url };']);
    expect(config.properties[0].description).toBe('Endpoint URL.');
  });

  it('does not mutate its input', () => {
    const input = entries();
    const snapshot = JSON.stringify(input);

    projectPublicDocEntries(input);

    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it.each(BLOCKED_PUBLIC_CLAIMS.map((pattern) => [String(pattern), pattern]))(
    'strips %s wherever it appears in a description',
    (_label, pattern) => {
      const projected = projectPublicDocEntries([
        {
          kind: 'interface',
          name: 'Example',
          description: `Leading sentence. ${
            pattern.source.includes('telemetry')
              ? 'No telemetry is emitted unless this is provided.'
              : 'Installation is inert.'
          }`,
          properties: [],
        },
      ]);

      expect(JSON.stringify(projected)).not.toMatch(pattern);
    }
  );
});

describe('assertPublicDocOutput', () => {
  it('accepts serialized output with no barred claim', () => {
    expect(() =>
      assertPublicDocOutput('chat', JSON.stringify(projectPublicDocEntries(entries())))
    ).not.toThrow();
  });

  it('throws when a barred claim survives into serialized output', () => {
    expect(() =>
      assertPublicDocOutput('chat', JSON.stringify(entries()))
    ).toThrow(/chat/u);
  });

  it('names the offending claim so the failure is actionable', () => {
    expect(() =>
      assertPublicDocOutput('ag-ui', 'Installation is inert.')
    ).toThrow(/installation is inert/iu);
  });
});
