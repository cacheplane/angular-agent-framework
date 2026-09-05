import { defineMemory } from '@dawn-ai/sdk';
import { z } from 'zod';

export default defineMemory({
  kind: 'semantic',
  scope: ['workspace', 'route', 'agent'],
  identity: ['fixtureId', 'source'],
  schema: z.object({
    fixtureId: z.enum(['atlas', 'beacon']),
    observation: z.string().min(1).max(500),
    source: z.enum(['fixture:atlas:v1', 'fixture:beacon:v1']),
  }),
});
