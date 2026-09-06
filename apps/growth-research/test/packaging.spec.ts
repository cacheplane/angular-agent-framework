import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { stageLangSmith } from '../scripts/package-langsmith.mts';

const roots: string[] = [];
const graphId = '/enrichment/research#agent';
const publicGraphId = 'growth_research';
const graphEntry = './.dawn/build/enrichment-research.ts:graph';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'growth-packaging-test-'));
  roots.push(root);
  const files: Record<string, string> = {
    'package.json': JSON.stringify({ name: 'fixture', version: '0.0.0', private: true, type: 'module', engines: { node: '24' }, dependencies: { '@dawn-ai/core': '0.8.24' } }),
    'deployment-package-lock.json': JSON.stringify({ name: 'fixture', version: '0.0.0', lockfileVersion: 3, packages: { '': { name: 'fixture', version: '0.0.0', engines: { node: '24' }, dependencies: { '@dawn-ai/core': '0.8.24' } }, 'node_modules/@dawn-ai/core': { version: '0.8.24', resolved: 'https://registry.npmjs.org/@dawn-ai/core/-/core-0.8.24.tgz' } } }),
    'dawn.config.ts': 'export default { build: { targets: ["langsmith"] } };',
    'src/app/enrichment/research/index.ts': 'export default {};',
    'src/app/enrichment/research/plan.md': '# Synthetic plan\nVerify fixture evidence.',
    'src/app/enrichment/research/skills/company-evidence/SKILL.md': '# Company evidence\nSynthetic fixtures only.',
    '.dawn/build/enrichment-research.ts': 'export const graph = {};',
    '.dawn/build/langgraph.json': JSON.stringify({ graphs: { [graphId]: graphEntry }, env: '.env.example', node_version: '22', dependencies: ['.'] }),
    '.env': 'SECRET=do-not-copy',
    '.env.example': 'SECRET=',
    'README.md': 'Do not copy arbitrary root files',
    '.dawn/build/debug.log': 'Do not copy arbitrary build files',
    '.dawn/routes/enrichment/research/tools.json': '{"readFixture":{"input":{}}}',
  };
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
  }
  return root;
}

afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });

describe('standalone LangSmith packaging', () => {
  it('packages the production adapter and private generated company child, excluding operator modules', async () => {
    const root = await fixture();
    const path = join(root, '.dawn/build/langgraph.json');
    const config = JSON.parse(await readFile(path, 'utf8'));
    config.graphs['/enrichment/company-pilot#agent'] = './.dawn/build/enrichment-company-pilot.ts:graph';
    await writeFile(path, JSON.stringify(config));
    for (const file of ['.dawn/build/enrichment-company-pilot.ts', 'src/app/enrichment/company-pilot/index.ts', 'src/production/entry.ts', 'src/pilot/baseline.ts']) {
      await mkdir(dirname(join(root, file)), { recursive: true });
      await writeFile(join(root, file), 'export const privatePilot = true;');
    }
    const output = await stageLangSmith(root);
    expect(await readdir(join(output, '.dawn/build'))).toEqual(['enrichment-company-pilot.ts', 'enrichment-research.ts']);
    expect(await readdir(join(output, 'src/app/enrichment'))).toEqual(['company-pilot', 'research']);
    expect(JSON.parse(await readFile(join(output, 'langgraph.json'), 'utf8')).graphs).toEqual({ growth_research: graphEntry, growth_company: './src/production/entry.ts:graph' });
    await expect(readFile(join(output, 'src/pilot/baseline.ts'))).rejects.toThrow();
  });
  it('normalizes Node 22 to 24 and clears environment file configuration', async () => {
    const output = await stageLangSmith(await fixture());
    const config = JSON.parse(await readFile(join(output, 'langgraph.json'), 'utf8'));
    expect(config).toEqual({ graphs: { [publicGraphId]: graphEntry }, env: {}, node_version: '24', api_version: '0.13.4', dependencies: ['.'] });
  });

  it('accepts the explicit pinned Agent Server API version', async () => {
    const root = await fixture();
    const path = join(root, '.dawn/build/langgraph.json');
    const config = JSON.parse(await readFile(path, 'utf8'));
    config.api_version = '0.13.4';
    await writeFile(path, JSON.stringify(config));
    const output = await stageLangSmith(root);
    expect(JSON.parse(await readFile(join(output, 'langgraph.json'), 'utf8')).api_version).toBe('0.13.4');
  });

  it.each(['0.13', '0.13.5', 0.134, null])('rejects unexpected explicit Agent Server API versions: %j', async version => {
    const root = await fixture();
    const path = join(root, '.dawn/build/langgraph.json');
    const config = JSON.parse(await readFile(path, 'utf8'));
    config.api_version = version;
    await writeFile(path, JSON.stringify(config));
    await expect(stageLangSmith(root)).rejects.toThrow(/API version/i);
  });

  it('copies only approved sources and preserves authored skills and plans unchanged', async () => {
    const root = await fixture();
    await writeFile(join(root, 'src/.env.production'), 'SECRET=inside-source');
    const output = await stageLangSmith(root);
    expect(await readdir(output)).toEqual(['.dawn', 'dawn.config.ts', 'langgraph.json', 'package-lock.json', 'package.json', 'src', 'tsconfig.json']);
    expect(await readdir(join(output, '.dawn/build'))).toEqual(['enrichment-research.ts']);
    expect(await readdir(join(output, 'src'))).toEqual(['app']);
    for (const path of ['src/app/enrichment/research/plan.md', 'src/app/enrichment/research/skills/company-evidence/SKILL.md']) {
      expect(await readFile(join(output, path), 'utf8')).toBe(await readFile(join(root, path), 'utf8'));
    }
  });

  it('emits standalone NodeNext compiler settings without workspace inheritance for server schema extraction', async () => {
    const root = await fixture();
    await writeFile(join(root, 'tsconfig.json'), JSON.stringify({ extends: '../../tsconfig.base.json', compilerOptions: { paths: { '@internal/*': ['../../libs/*'] } } }));
    const output = await stageLangSmith(root);
    expect(JSON.parse(await readFile(join(output, 'tsconfig.json'), 'utf8'))).toEqual({
      compilerOptions: { target: 'ES2024', module: 'NodeNext', moduleResolution: 'NodeNext', types: ['node'], skipLibCheck: true, noEmit: true },
      include: ['src/**/*.ts', 'dawn.config.ts', '.dawn/build/**/*.ts'],
    });
  });

  it('preserves generated runtime tool schemas at their original route paths', async () => {
    const root = await fixture();
    const output = await stageLangSmith(root);
    expect(await readFile(join(output, '.dawn/routes/enrichment/research/tools.json'), 'utf8')).toBe('{"readFixture":{"input":{}}}');
  });

  it('keeps the known specialist entry private while preserving its generated sources', async () => {
    const root = await fixture();
    const configPath = join(root, '.dawn/build/langgraph.json');
    const config = JSON.parse(await readFile(configPath, 'utf8'));
    config.graphs['/enrichment/research/subagents/researcher#agent'] = './.dawn/build/enrichment-research-subagents-researcher.ts:graph';
    await writeFile(configPath, JSON.stringify(config));
    await writeFile(join(root, '.dawn/build/enrichment-research-subagents-researcher.ts'), 'export const graph = {};');
    const output = await stageLangSmith(root);
    expect(JSON.parse(await readFile(join(output, 'langgraph.json'), 'utf8')).graphs).toEqual({ [publicGraphId]: graphEntry });
    expect(await readFile(join(output, '.dawn/build/enrichment-research-subagents-researcher.ts'), 'utf8')).toContain('export const graph');
  });

  it.each([{}, { '/unexpected#agent': graphEntry }, { [graphId]: graphEntry, '/extra#agent': graphEntry }])('requires exactly the expected graph discovery: %j', async graphs => {
    const root = await fixture();
    await writeFile(join(root, '.dawn/build/langgraph.json'), JSON.stringify({ graphs, env: '.env.example', node_version: '22', dependencies: ['.'] }));
    await expect(stageLangSmith(root)).rejects.toThrow(/graph/i);
  });

  it.each(['../../outside.ts:graph', '/tmp/outside.ts:graph', './.dawn/build/missing.ts:graph', './.dawn/build/enrichment-research.ts:nope'])('rejects graph references outside the expected staged layout: %s', async entry => {
    const root = await fixture();
    await writeFile(join(root, '.dawn/build/langgraph.json'), JSON.stringify({ graphs: { [graphId]: entry }, env: '.env.example', node_version: '22', dependencies: ['.'] }));
    await expect(stageLangSmith(root)).rejects.toThrow(/graph/i);
  });

  it('rejects outside-root symlinks in allowed source files', async () => {
    const root = await fixture();
    const outside = await fixture();
    await symlink(join(outside, 'dawn.config.ts'), join(root, 'src/leak.ts'));
    await expect(stageLangSmith(root)).rejects.toThrow(/symlink|outside/i);
  });

  it.each(['workspace:*', 'file:../../libs/growth', '^0.8.24'])('rejects non-exact or local dependencies: %s', async version => {
    const root = await fixture();
    const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
    manifest.dependencies['@dawn-ai/core'] = version;
    await writeFile(join(root, 'package.json'), JSON.stringify(manifest));
    await expect(stageLangSmith(root)).rejects.toThrow(/dependenc/i);
  });

  it('preserves an intentional auth configuration and its staged source', async () => {
    const root = await fixture();
    await writeFile(join(root, 'src/auth.ts'), 'export const auth = {};');
    const configPath = join(root, '.dawn/build/langgraph.json');
    const config = JSON.parse(await readFile(configPath, 'utf8'));
    config.auth = { path: './src/auth.ts:auth', disable_studio_auth: false };
    await writeFile(configPath, JSON.stringify(config));
    const output = await stageLangSmith(root);
    expect(JSON.parse(await readFile(join(output, 'langgraph.json'), 'utf8')).auth).toEqual(config.auth);
    expect(await readFile(join(output, 'src/auth.ts'), 'utf8')).toContain('export const auth');
  });

  it('fails closed on unexpected generated configuration fields', async () => {
    const root = await fixture();
    const path = join(root, '.dawn/build/langgraph.json');
    const config = JSON.parse(await readFile(path, 'utf8'));
    config.http = { app: '../../outside.ts:app' };
    await writeFile(path, JSON.stringify(config));
    await expect(stageLangSmith(root)).rejects.toThrow(/unexpected/i);
  });
});
