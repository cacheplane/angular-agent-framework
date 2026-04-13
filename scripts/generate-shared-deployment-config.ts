import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { capabilities } from '../apps/cockpit/scripts/capability-registry';

type LangGraphManifest = {
  graphs: Record<string, string>;
  dependencies?: string[];
  env?: string;
  python_version?: string;
};

const rootDir = process.cwd();
const deploymentDir = resolve(rootDir, 'deployments/shared-dev');
const outputPath = resolve(deploymentDir, 'langgraph.json');
const stagedDependenciesDir = resolve(deploymentDir, 'deps');

const readManifest = (filePath: string): LangGraphManifest => JSON.parse(readFileSync(filePath, 'utf8')) as LangGraphManifest;
const toDeploymentPath = (dependencyRoot: string, entrypoint: string): string => {
  const normalizedEntrypoint = entrypoint.startsWith('./') ? entrypoint.slice(2) : entrypoint;
  return `${dependencyRoot}/${normalizedEntrypoint}`;
};

const graphs: Record<string, string> = {};
const dependencies = new Set<string>();
const stagedDependencyRoots = new Map<string, string>();
const addGraph = (name: string, path: string): void => {
  const existing = graphs[name];
  if (existing && existing !== path) {
    throw new Error(`Conflicting graph path for ${name}: ${existing} !== ${path}`);
  }
  graphs[name] = path;
};

const stageDependency = (sourceRoot: string, alias: string): string => {
  const existing = stagedDependencyRoots.get(sourceRoot);
  if (existing) {
    return existing;
  }

  const sourceDir = resolve(rootDir, sourceRoot);
  const stagedDir = resolve(stagedDependenciesDir, alias);
  cpSync(sourceDir, stagedDir, { recursive: true });

  const relativePath = `./deps/${alias}`;
  stagedDependencyRoots.set(sourceRoot, relativePath);
  dependencies.add(relativePath);
  return relativePath;
};

rmSync(stagedDependenciesDir, { recursive: true, force: true });
mkdirSync(stagedDependenciesDir, { recursive: true });

for (const capability of capabilities) {
  if (capability.product !== 'langgraph' && capability.product !== 'deep-agents') {
    continue;
  }

  const manifestPath = resolve(rootDir, capability.pythonDir, 'langgraph.json');
  const manifest = readManifest(manifestPath);
  if (!manifest.graphs) {
    throw new Error(`Missing graphs in ${manifestPath}`);
  }
  const stagedDependencyRoot = stageDependency(capability.pythonDir, capability.id);

  for (const [graphName, entrypoint] of Object.entries(manifest.graphs)) {
    addGraph(graphName, toDeploymentPath(stagedDependencyRoot, entrypoint));
  }
}

const streamingManifestPath = resolve(rootDir, 'cockpit/langgraph/streaming/python/langgraph.json');
const streamingManifest = readManifest(streamingManifestPath);
if (!streamingManifest.graphs) {
  throw new Error(`Missing graphs in ${streamingManifestPath}`);
}

const manifest: LangGraphManifest = {
  graphs,
  dependencies: [...dependencies].sort(),
  python_version: streamingManifest.python_version ?? '3.12',
  env: streamingManifest.env ?? '.env',
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Generated ${outputPath} with ${Object.keys(graphs).length} graphs`);
