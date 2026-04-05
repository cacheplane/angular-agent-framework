import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { capabilities } from './capability-registry';

const graphs: Record<string, string> = {};
for (const c of capabilities) {
  graphs[c.graphName] = `./${c.pythonDir}/src/graph.py:graph`;
}

const config = { graphs, dependencies: capabilities.map((c) => `./${c.pythonDir}/pyproject.toml`), env: '.env' };
const out = resolve(process.cwd(), 'langgraph-combined.json');
writeFileSync(out, JSON.stringify(config, null, 2) + '\n');
console.log(`Generated ${out} with ${Object.keys(graphs).length} graphs`);
