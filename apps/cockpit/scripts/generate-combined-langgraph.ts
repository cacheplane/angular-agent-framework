import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { capabilities } from './capability-registry';

type LangGraphManifest = {
  graphs: Record<string, string>;
};

const manifestCache = new Map<string, LangGraphManifest>();
function readManifest(pythonDir: string): LangGraphManifest {
  const existing = manifestCache.get(pythonDir);
  if (existing) {
    return existing;
  }

  const manifestPath = resolve(process.cwd(), pythonDir, 'langgraph.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as LangGraphManifest;
  manifestCache.set(pythonDir, manifest);
  return manifest;
}

function normalizeEntrypoint(pythonDir: string, graphName: string): string {
  const manifest = readManifest(pythonDir);
  const entrypoint = manifest.graphs[graphName]
    ?? (() => {
      const manifestEntries = Object.entries(manifest.graphs);
      if (manifestEntries.length === 1) {
        return manifestEntries[0]?.[1];
      }
      return undefined;
    })();
  if (!entrypoint) {
    throw new Error(`Missing graph '${graphName}' in ${pythonDir}/langgraph.json`);
  }

  return entrypoint.startsWith('./') ? entrypoint.slice(2) : entrypoint;
}

const graphs: Record<string, string> = {};
const dependencies = new Set<string>();
for (const c of capabilities) {
  graphs[c.graphName] = `./${c.pythonDir}/${normalizeEntrypoint(c.pythonDir, c.graphName)}`;
  dependencies.add(`./${c.pythonDir}`);
}

const config = { graphs, dependencies: [...dependencies], env: '.env' };
const out = resolve(process.cwd(), 'langgraph-combined.json');
writeFileSync(out, JSON.stringify(config, null, 2) + '\n');
console.log(`Generated ${out} with ${Object.keys(graphs).length} graphs`);
