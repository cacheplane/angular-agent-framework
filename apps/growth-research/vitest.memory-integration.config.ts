import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { environment: 'node', include: ['apps/growth-research/test/memory.integration.spec.ts'] } });
