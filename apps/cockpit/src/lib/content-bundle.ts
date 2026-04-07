import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { codeToHtml } from 'shiki';
import type { CapabilityPresentation } from './route-resolution';
import { type DocSection, extractTsDocSections, extractPyDocSections } from './extract-docs';
import { renderMarkdown } from './render-markdown';

/**
 * Paths in the manifest are repo-root-relative (e.g., "apps/cockpit/src/app/page.tsx").
 * Next.js / Turbopack may change CWD at runtime, so we find the workspace root
 * by walking up from CWD until we find nx.json (the Nx workspace marker).
 */
function findWorkspaceRoot(): string {
  let dir = process.cwd();
  while (dir !== resolve(dir, '..')) {
    if (existsSync(join(dir, 'nx.json'))) return dir;
    dir = resolve(dir, '..');
  }
  return process.cwd();
}

const WORKSPACE_ROOT = findWorkspaceRoot();

export interface NarrativeDoc {
  title: string;
  html: string;
  sourceFile: string;
}

export interface ContentBundle {
  codeFiles: Record<string, string>;
  promptFiles: Record<string, string>;
  runtimeUrl: string | null;
  docSections: DocSection[];
  narrativeDocs: NarrativeDoc[];
}

export function resolveRuntimeUrl(options: {
  runtimeUrl?: string;
  devPort?: number;
}): string | null {
  const { runtimeUrl, devPort } = options;

  if (!runtimeUrl && !devPort) {
    return null;
  }

  const baseUrl = process.env['NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL'] || 'https://examples.cacheplane.ai';

  if (baseUrl && runtimeUrl) {
    return `${baseUrl}/${runtimeUrl}`;
  }

  if (devPort) {
    return `http://localhost:${devPort}`;
  }

  return null;
}

const LANG_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  py: 'python',
  md: 'markdown',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  css: 'css',
  html: 'html',
};

function detectLang(filePath: string): string {
  const ext = filePath.split('.').pop() ?? '';
  return LANG_MAP[ext] ?? 'text';
}

function readFileSafe(filePath: string): string | null {
  try {
    return readFileSync(resolve(WORKSPACE_ROOT, filePath), 'utf-8');
  } catch {
    return null;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function highlightCode(
  source: string,
  filePath: string
): Promise<string> {
  try {
    return await codeToHtml(source, {
      lang: detectLang(filePath),
      theme: 'tokyo-night',
    });
  } catch {
    return `<pre><code>${escapeHtml(source)}</code></pre>`;
  }
}

export async function getContentBundle(
  presentation: CapabilityPresentation
): Promise<ContentBundle> {
  if (presentation.kind === 'docs-only') {
    return { codeFiles: {}, promptFiles: {}, runtimeUrl: null, docSections: [], narrativeDocs: [] };
  }

  const backendPaths = presentation.backendAssetPaths ?? [];
  const allCodePaths = [...presentation.codeAssetPaths, ...backendPaths];
  const docSections: DocSection[] = [];

  const codeFiles: Record<string, string> = {};
  for (const path of allCodePaths) {
    const source = readFileSafe(path);
    if (source === null) {
      codeFiles[path] = `File not found: ${path}`;
    } else {
      codeFiles[path] = await highlightCode(source, path);

      // Extract doc sections
      const fileName = path.split('/').pop() ?? path;
      if (path.endsWith('.ts') || path.endsWith('.tsx')) {
        docSections.push(...extractTsDocSections(source, fileName));
      } else if (path.endsWith('.py')) {
        docSections.push(...extractPyDocSections(source, fileName));
      }
    }
  }

  const promptFiles: Record<string, string> = {};
  for (const path of presentation.promptAssetPaths) {
    const source = readFileSafe(path);
    promptFiles[path] = source ?? `File not found: ${path}`;
  }

  const runtimeUrl = resolveRuntimeUrl({
    runtimeUrl: presentation.runtimeUrl,
    devPort: presentation.devPort,
  });

  const narrativeDocs: NarrativeDoc[] = [];
  const docPaths = presentation.docsAssetPaths ?? [];
  for (const path of docPaths) {
    const source = readFileSafe(path);
    if (source) {
      const rendered = await renderMarkdown(source);
      const fileName = path.split('/').pop() ?? path;
      narrativeDocs.push({ title: rendered.title, html: rendered.html, sourceFile: fileName });
    }
  }

  return { codeFiles, promptFiles, runtimeUrl, docSections, narrativeDocs };
}
