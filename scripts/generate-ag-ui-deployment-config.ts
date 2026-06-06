import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { capabilities } from '../apps/cockpit/scripts/capability-registry';

const GENERATED_HEADER = '# GENERATED — do not edit. Source: scripts/generate-ag-ui-deployment-config.ts';

export interface GenerateOptions {
  repoRoot: string;
  outDir: string;
}

interface AgUiTopic {
  topic: string;
  pythonDir: string;
}

function collectTopics(): AgUiTopic[] {
  const topics = capabilities
    .filter((c) => c.product === 'ag-ui' && c.pythonDir)
    .map<AgUiTopic>((c) => ({ topic: c.topic, pythonDir: c.pythonDir! }));
  topics.sort((a, b) => a.topic.localeCompare(b.topic));
  if (topics.length === 0) {
    throw new Error('No ag-ui topics with pythonDir found in capability registry');
  }
  return topics;
}

function stageDeps(repoRoot: string, outDir: string, topics: AgUiTopic[]): void {
  const depsDir = resolve(outDir, 'deps');
  rmSync(depsDir, { recursive: true, force: true });
  mkdirSync(depsDir, { recursive: true });
  for (const topic of topics) {
    const src = resolve(repoRoot, topic.pythonDir);
    const dst = resolve(depsDir, topic.topic);
    cpSync(src, dst, {
      recursive: true,
      // Exclude virtualenvs / bytecode, plus repo-metadata files (nx project.json,
      // tsconfig*) that would create cross-tree duplicates if mirrored into deps/.
      filter: (s) => {
        if (s.includes('.venv') || s.includes('__pycache__') || s.endsWith('.pyc')) return false;
        const basename = s.split('/').pop() ?? '';
        if (basename === 'project.json') return false;
        if (basename.startsWith('tsconfig') && basename.endsWith('.json')) return false;
        return true;
      },
    });
  }
}

function buildServerPy(topics: AgUiTopic[]): string {
  const imports = topics
    .map((t) => `from deps.${t.topic}.src.graph import graph as ${t.topic.replace(/-/g, '_')}_graph`)
    .join('\n');
  const mounts = topics
    .map(
      (t) =>
        `add_langgraph_fastapi_endpoint(\n` +
        `    app,\n` +
        `    LangGraphAgent(name="${t.topic}", graph=${t.topic.replace(/-/g, '_')}_graph),\n` +
        `    path="/agent/${t.topic}",\n` +
        `)`,
    )
    .join('\n');
  return `${GENERATED_HEADER}
# Multi-topic AG-UI FastAPI server. Aggregates each cockpit/ag-ui/*/python topic
# at /agent/<topic>. Health route /ok is unauthenticated; /agent/* requires
# X-Internal-Token matching the AG_UI_INTERNAL_TOKEN env var.
import os
from fastapi import FastAPI, Request, HTTPException
from ag_ui_langgraph import add_langgraph_fastapi_endpoint, LangGraphAgent

${imports}

AG_UI_INTERNAL_TOKEN = os.environ["AG_UI_INTERNAL_TOKEN"]

app = FastAPI(title="ag-ui-dev")


@app.middleware("http")
async def require_internal_token(request: Request, call_next):
    if request.url.path == "/ok":
        return await call_next(request)
    if request.headers.get("x-internal-token") != AG_UI_INTERNAL_TOKEN:
        raise HTTPException(status_code=401, detail="unauthorized")
    return await call_next(request)


@app.get("/ok")
def ok() -> dict:
    return {"ok": True}


${mounts}
`;
}

/**
 * Build a combined requirements.txt by extracting only the DIRECT dependencies
 * of each example (those whose `# via` comment names the cockpit project itself)
 * and letting pip resolve transitives at install time.
 *
 * We previously took the union with "highest version wins" across both examples'
 * full uv-exported requirements.txt. That produced internally-inconsistent sets:
 * one example's resolved transitive could be a higher version than what the
 * other example's direct dep accepted. Stripping to direct deps avoids that.
 */
function buildRequirementsTxt(repoRoot: string, topics: AgUiTopic[]): string {
  const directVersions = new Map<string, string>();
  for (const topic of topics) {
    const reqPath = resolve(repoRoot, topic.pythonDir, 'requirements.txt');
    const content = readFileSync(reqPath, 'utf8');
    for (const pkg of parseDirectDeps(content)) {
      const existing = directVersions.get(pkg.name);
      if (!existing || compareVersions(pkg.version, existing) > 0) {
        directVersions.set(pkg.name, pkg.version);
      }
    }
  }
  const sortedNames = [...directVersions.keys()].sort();
  const lines = sortedNames.map((n) => `${n}==${directVersions.get(n)}`);
  return `${GENERATED_HEADER}\n${lines.join('\n')}\n`;
}

interface DirectDep {
  name: string;
  version: string;
}

/**
 * Parse uv-exported requirements.txt and return only entries whose `# via`
 * block names a cockpit-* project (i.e., the package was directly declared
 * by the example, not pulled in transitively).
 *
 * uv export format:
 *   <name>==<version> [; <marker>]
 *       # via <single-via>
 * or:
 *   <name>==<version>
 *       # via
 *       #   <via-a>
 *       #   <via-b>
 */
function parseDirectDeps(content: string): DirectDep[] {
  const lines = content.split('\n');
  const out: DirectDep[] = [];
  let current: DirectDep | null = null;
  let viaList: string[] = [];

  const flush = () => {
    if (current && viaList.some((v) => v.startsWith('cockpit-'))) {
      out.push(current);
    }
    current = null;
    viaList = [];
  };

  for (const rawLine of lines) {
    if (rawLine.startsWith('-e ') || rawLine.startsWith('#')) {
      flush();
      continue;
    }
    const isIndented = rawLine.startsWith(' ') || rawLine.startsWith('\t');
    if (!isIndented) {
      flush();
      const line = rawLine.trim();
      if (!line) continue;
      const semi = line.indexOf(';');
      const beforeMarker = semi >= 0 ? line.slice(0, semi).trim() : line;
      const match = beforeMarker.match(/^([A-Za-z0-9_.-]+)==([A-Za-z0-9_.+-]+)$/);
      if (match) {
        current = { name: match[1], version: match[2] };
      }
      continue;
    }
    // Indented line: part of a `# via ...` block for the current package.
    const trimmed = rawLine.trim();
    if (trimmed.startsWith('# via ')) {
      viaList.push(trimmed.slice(6).trim());
    } else if (trimmed.startsWith('#')) {
      viaList.push(trimmed.replace(/^#\s*/, '').trim());
    }
  }
  flush();
  return out;
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((s) => parseInt(s, 10) || 0);
  const pb = b.split('.').map((s) => parseInt(s, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x - y;
  }
  return 0;
}

export function generateAgUiDeployment(options: GenerateOptions): void {
  const topics = collectTopics();
  mkdirSync(options.outDir, { recursive: true });
  stageDeps(options.repoRoot, options.outDir, topics);
  writeFileSync(resolve(options.outDir, 'server.py'), buildServerPy(topics));
  writeFileSync(resolve(options.outDir, 'requirements.txt'), buildRequirementsTxt(options.repoRoot, topics));
}

if (require.main === module) {
  const repoRoot = resolve(__dirname, '..');
  const outDir = resolve(repoRoot, 'deployments/ag-ui-dev');
  generateAgUiDeployment({ repoRoot, outDir });
  console.log('Generated deployments/ag-ui-dev/{server.py,requirements.txt,deps/}');
}
