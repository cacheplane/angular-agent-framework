// scripts/generate-shared-deployment-config.spec.ts
// SPDX-License-Identifier: MIT
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('generate-shared-deployment-config', () => {
  it('includes the canonical-demo chat graph in the aggregated manifest', () => {
    const root = resolve(__dirname, '..');
    execSync('npx tsx scripts/generate-shared-deployment-config.ts', {
      cwd: root,
      stdio: 'pipe',
    });
    const manifestPath = resolve(root, 'deployments/shared-dev/langgraph.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      graphs: Record<string, string>;
      dependencies: string[];
    };
    expect(manifest.graphs).toHaveProperty('chat');
    expect(manifest.graphs.chat).toMatch(/examples-chat\/.+\.py:graph$/);
    expect(manifest.dependencies.some((d) => d.includes('examples-chat'))).toBe(true);
  });

  it('excludes ag-ui capabilities (Railway-deployed; no langgraph.json)', () => {
    // Regression: ag-ui capabilities gained a pythonDir when they got real
    // uvicorn backends, which made the generator try to read a langgraph.json
    // they don't have — crashing every LangGraph deploy. They must be skipped
    // (they deploy via scripts/generate-ag-ui-deployment-config.ts → Railway).
    const root = resolve(__dirname, '..');
    execSync('npx tsx scripts/generate-shared-deployment-config.ts', {
      cwd: root,
      stdio: 'pipe',
    });
    const manifestPath = resolve(root, 'deployments/shared-dev/langgraph.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      dependencies: string[];
    };
    expect(manifest.dependencies.some((d) => d.includes('ag-ui'))).toBe(false);
  });
});
