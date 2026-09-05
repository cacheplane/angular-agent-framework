import { copyFile, lstat, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const graphId = '/enrichment/research#agent';
const publicGraphId = 'growth_research';
const apiVersion = '0.13.4';
const deploymentTsConfig = {
  compilerOptions: { target: 'ES2024', module: 'NodeNext', moduleResolution: 'NodeNext', types: ['node'], skipLibCheck: true, noEmit: true },
  include: ['src/**/*.ts', 'dawn.config.ts', '.dawn/build/**/*.ts'],
};
type JsonObject = Record<string, unknown>;

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Unexpected ${label} shape`);
  return value as JsonObject;
}

async function readObject(path: string): Promise<JsonObject> {
  return object(JSON.parse(await readFile(path, 'utf8')), path);
}

export function deploymentManifest(value: unknown): JsonObject {
  const manifest = object(value, 'package manifest');
  const dependencies = object(manifest['dependencies'], 'dependencies');
  for (const [name, version] of Object.entries(dependencies)) {
    if (typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version)) {
      throw new Error(`Deployment dependency ${name} must use an exact registry version`);
    }
  }
  if (manifest['private'] !== true || manifest['type'] !== 'module' || object(manifest['engines'], 'engines')['node'] !== '24') {
    throw new Error('Unexpected package manifest: private ESM application on Node 24 required');
  }
  return { name: manifest['name'], version: manifest['version'], private: true, type: 'module', engines: { node: '24' }, dependencies };
}

async function contained(root: string, path: string): Promise<void> {
  const rel = relative(root, await realpath(path));
  if (rel === '..' || rel.startsWith('../') || isAbsolute(rel)) throw new Error(`Outside-root symlink: ${relative(root, path)}`);
  if ((await lstat(path)).isSymbolicLink()) throw new Error(`Symlinks are not allowed in deployment inputs: ${relative(root, path)}`);
}

async function copySource(root: string, path: string, output: string): Promise<void> {
  await contained(root, path);
  const name = basename(path);
  if (name.startsWith('.') || name === 'node_modules' || /\.(spec|test)\.[cm]?ts$/.test(name)) return;
  if ((await lstat(path)).isDirectory()) {
    await mkdir(output, { recursive: true });
    for (const child of await readdir(path)) await copySource(root, join(path, child), join(output, child));
  } else if (['.ts', '.mts', '.json', '.md'].includes(extname(name))) {
    await copyFile(path, output);
  } else {
    throw new Error(`Unexpected source file type: ${relative(root, path)}`);
  }
}

async function validateReference(root: string, value: unknown, label: string): Promise<void> {
  if (typeof value !== 'string' || !/^\.\/(?:\.dawn\/build\/|src\/)[\w./-]+\.[cm]?ts:[A-Za-z_$][\w$]*$/.test(value)) {
    throw new Error(`Unexpected ${label} reference`);
  }
  const path = value.slice(0, value.lastIndexOf(':'));
  if (path.split('/').includes('..')) throw new Error(`Unexpected ${label} path traversal`);
  try { await contained(root, resolve(root, path)); } catch { throw new Error(`Invalid staged ${label} path: ${path}`); }
}

function validateLock(lock: JsonObject, manifest: JsonObject): void {
  if (lock['lockfileVersion'] !== 3) throw new Error('Unexpected deployment lockfile version');
  const packages = object(lock['packages'], 'lock packages');
  const root = object(packages[''], 'lock root');
  if (JSON.stringify(root['dependencies']) !== JSON.stringify(manifest['dependencies'])) {
    throw new Error('Deployment dependency lock is stale; regenerate deployment-package-lock.json');
  }
  for (const [path, entry] of Object.entries(packages)) {
    const record = object(entry, 'locked dependency');
    if (path && !path.startsWith('node_modules/')) throw new Error('Unexpected workspace dependency in deployment lock');
    if (record['link'] || (typeof record['resolved'] === 'string' && !record['resolved'].startsWith('https://registry.npmjs.org/'))) {
      throw new Error('Deployment lock contains a non-registry dependency');
    }
    for (const section of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
      for (const version of Object.values(object(record[section] ?? {}, 'locked dependencies'))) {
        if (typeof version !== 'string' || /^(workspace:|file:|link:)/.test(version)) throw new Error('Deployment lock contains a local dependency');
      }
    }
  }
}

export async function verifyLangSmithArtifact(output: string): Promise<void> {
  const root = await realpath(output);
  const config = await readObject(join(root, 'langgraph.json'));
  const graphs = object(config['graphs'], 'graphs');
  if (Object.keys(graphs).length !== 1 || typeof graphs[publicGraphId] !== 'string' || !/^\.\/\.dawn\/build\/[\w-]+\.ts:graph$/.test(graphs[publicGraphId])) {
    throw new Error(`Expected exactly the ${publicGraphId} public graph`);
  }
  await validateReference(root, graphs[publicGraphId], 'graph');
  if (JSON.stringify(await readObject(join(root, 'tsconfig.json'))) !== JSON.stringify(deploymentTsConfig)) throw new Error('Unexpected standalone TypeScript configuration');
  if (config['api_version'] !== apiVersion) throw new Error(`Expected Agent Server API version ${apiVersion}`);
  if (config['node_version'] !== '24' || JSON.stringify(config['env']) !== '{}' || JSON.stringify(config['dependencies']) !== '["."]') {
    throw new Error('Unexpected normalized deployment config');
  }
  if (config['auth']) await validateReference(root, object(config['auth'], 'auth')['path'], 'auth');
  const visit = async (path: string): Promise<void> => {
    await contained(root, path);
    if (basename(path).startsWith('.env')) throw new Error('Environment files are forbidden in deployment artifacts');
    if ((await lstat(path)).isDirectory()) for (const child of await readdir(path)) await visit(join(path, child));
  };
  await visit(root);
  const manifest = deploymentManifest(await readObject(join(root, 'package.json')));
  validateLock(await readObject(join(root, 'package-lock.json')), manifest);
}

export async function stageLangSmith(appRoot: string): Promise<string> {
  const root = await realpath(appRoot);
  for (const path of ['src', 'dawn.config.ts', 'package.json', 'deployment-package-lock.json', '.dawn', '.dawn/build', '.dawn/build/langgraph.json']) {
    await contained(root, join(root, path));
  }
  const config = await readObject(join(root, '.dawn/build/langgraph.json'));
  const generatedGraphs = object(config['graphs'], 'graphs');
  const specialistId = '/enrichment/research/subagents/researcher#agent';
  if (Object.keys(generatedGraphs).some(key => key !== graphId && key !== specialistId)) throw new Error('Unexpected generated graph');
  if (specialistId in generatedGraphs) {
    if (generatedGraphs[specialistId] !== './.dawn/build/enrichment-research-subagents-researcher.ts:graph') throw new Error('Unexpected specialist graph entry');
    await validateReference(root, generatedGraphs[specialistId], 'specialist graph');
  }
  if (Object.keys(config).some(key => !['graphs', 'env', 'node_version', 'api_version', 'dependencies', 'auth'].includes(key))) throw new Error('Unexpected generated configuration field');
  if ('api_version' in config && config['api_version'] !== apiVersion) throw new Error(`Unexpected Agent Server API version; expected ${apiVersion}`);
  if (!['22', '24'].includes(String(config['node_version'])) || JSON.stringify(config['dependencies']) !== '["."]' || !(typeof config['env'] === 'string' || (config['env'] && typeof config['env'] === 'object' && !Array.isArray(config['env'])))) {
    throw new Error('Unexpected generated deployment config shape');
  }
  if (config['auth']) {
    const auth = object(config['auth'], 'auth');
    if (Object.keys(auth).some(key => !['path', 'disable_studio_auth'].includes(key)) || ('disable_studio_auth' in auth && typeof auth['disable_studio_auth'] !== 'boolean')) throw new Error('Unexpected auth configuration');
  }
  const manifest = deploymentManifest(await readObject(join(root, 'package.json')));
  const lock = await readObject(join(root, 'deployment-package-lock.json'));
  validateLock(lock, manifest);
  const output = join(root, '.deployment');
  try { await contained(root, output); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  await rm(output, { recursive: true, force: true });
  await mkdir(join(output, '.dawn/build'), { recursive: true });
  await copySource(root, join(root, 'src'), join(output, 'src'));
  await copyFile(join(root, 'dawn.config.ts'), join(output, 'dawn.config.ts'));
  const copySchemas = async (path: string, target: string): Promise<void> => {
    await contained(root, path);
    if ((await lstat(path)).isDirectory()) {
      await mkdir(target, { recursive: true });
      for (const name of await readdir(path)) await copySchemas(join(path, name), join(target, name));
    } else if (basename(path) === 'tools.json') {
      await readObject(path);
      await copyFile(path, target);
    }
  };
  await copySchemas(join(root, '.dawn/routes'), join(output, '.dawn/routes'));
  for (const name of await readdir(join(root, '.dawn/build'))) {
    if (!name.endsWith('.ts')) continue;
    await contained(root, join(root, '.dawn/build', name));
    await copyFile(join(root, '.dawn/build', name), join(output, '.dawn/build', name));
  }
  for (const [name, value] of Object.entries({ 'package.json': manifest, 'package-lock.json': lock, 'tsconfig.json': deploymentTsConfig, 'langgraph.json': { ...config, graphs: { [publicGraphId]: generatedGraphs[graphId] }, node_version: '24', api_version: apiVersion, dependencies: ['.'], env: {} } })) {
    await writeFile(join(output, name), `${JSON.stringify(value, null, 2)}\n`);
  }
  try { await verifyLangSmithArtifact(output); } catch (error) { await rm(output, { recursive: true, force: true }); throw error; }
  return output;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`Staged LangSmith artifact: ${await stageLangSmith(resolve(dirname(fileURLToPath(import.meta.url)), '..'))}`);
}
