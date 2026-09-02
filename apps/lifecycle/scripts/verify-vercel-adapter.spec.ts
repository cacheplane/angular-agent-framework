import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  assertExpectedDawnDefaultExport,
  rewriteDedicatedDawnDatabaseEnv,
  rewriteDawnModuleImports,
} from './verify-vercel-adapter.mjs';

describe('Dawn generated storage isolation', () => {
  it('rewrites only the generated Dawn store environment name', () => {
    const generated = [
      'const url = binding(env, "DATABASE_URL")',
      'throw new Error("DATABASE_URL is missing")',
    ].join('\n');

    const rewritten = rewriteDedicatedDawnDatabaseEnv(generated);

    expect(rewritten).toContain('binding(env, "DAWN_DATABASE_URL")');
    expect(rewritten).toContain('DAWN_DATABASE_URL is missing');
    expect(rewritten).not.toMatch(/(?<!DAWN_)DATABASE_URL/u);
  });

  it('fails closed when the expected generated lookup is absent', () => {
    expect(() =>
      rewriteDedicatedDawnDatabaseEnv('export const unrelated = true')
    ).toThrow(/expected DATABASE_URL lookup/u);
  });

  it('rewrites generated Dawn TypeScript module imports for the Node bundle', () => {
    const generated = [
      'import * as middlewareModule from "../../src/middleware.ts"',
      'import * as route0 from "../../src/app/dispatch/index.ts"',
    ].join('\n');

    const rewritten = rewriteDawnModuleImports(generated);

    expect(rewritten).toContain('from "../../src/middleware.js"');
    expect(rewritten).toContain('from "../../src/app/dispatch/index.js"');
    expect(rewritten).not.toMatch(/from "\.\.\/\.\.\/src\/.+\.ts"/u);
  });

  it('fails closed when generated Dawn module imports change shape', () => {
    expect(() => rewriteDawnModuleImports('export default {}')).toThrow(
      /expected TypeScript module imports/u
    );
  });

  it('fails closed when Dawn changes the generated default export shape', () => {
    expect(() =>
      assertExpectedDawnDefaultExport('export const app = {}')
    ).toThrow(/expected default export/u);
    expect(() =>
      assertExpectedDawnDefaultExport('export default app\n')
    ).not.toThrow();
  });

  it('pins the isolated Node 24 Hono/Vercel runtime without public secrets', async () => {
    const packageJson = JSON.parse(
      readFileSync(
        resolve(process.cwd(), 'apps/lifecycle/package.json'),
        'utf8'
      )
    ) as Record<string, unknown>;
    const vercel = JSON.parse(
      readFileSync(resolve(process.cwd(), 'apps/lifecycle/vercel.json'), 'utf8')
    ) as Record<string, unknown>;
    const tsconfig = JSON.parse(
      readFileSync(resolve(process.cwd(), 'apps/lifecycle/tsconfig.json'), 'utf8')
    ) as { compilerOptions?: Record<string, unknown>; extends?: string };
    const runtimeTsconfigBase = JSON.parse(
      readFileSync(
        resolve(process.cwd(), 'apps/lifecycle/tsconfig.runtime-base.json'),
        'utf8'
      )
    ) as { compilerOptions?: Record<string, unknown> };
    const config = (await import('../dawn.config.js')).default;
    expect(packageJson['engines']).toEqual({ node: '>=24.0.0' });
    expect(packageJson['dependencies']).toMatchObject({
      '@dawn-ai/cli': '0.8.21',
      '@dawn-ai/core': '0.8.21',
      '@dawn-ai/langgraph': '0.8.21',
      '@dawn-ai/postgres-storage': '0.8.21',
      '@dawn-ai/sdk': '0.8.21',
      '@neondatabase/serverless': '0.10.4',
      hono: '4.13.5',
      resend: '6.10.0',
      zod: '4.4.3',
    });
    expect(config).toEqual({ appDir: 'src/app', build: { targets: ['hono'] } });
    expect(vercel['rewrites']).toEqual([
      { source: '/:path*', destination: '/api' },
    ]);
    expect(vercel['functions']).toEqual({
      'api/index.ts': { maxDuration: 60 },
    });
    expect(vercel['outputDirectory']).toBe('public');
    expect(tsconfig.extends).toBe('./tsconfig.runtime-base.json');
    expect(runtimeTsconfigBase.compilerOptions).toMatchObject({
      composite: false,
      declaration: false,
      declarationMap: false,
      emitDeclarationOnly: false,
    });
    expect(tsconfig.compilerOptions?.['noEmit']).toBe(false);
    expect(tsconfig.compilerOptions?.['noEmitOnError']).toBe(false);
    expect(
      existsSync(resolve(process.cwd(), 'apps/lifecycle/public/.gitkeep'))
    ).toBe(true);
    expect(JSON.stringify({ packageJson, vercel })).not.toContain(
      'NEXT_PUBLIC_'
    );
  });
});
