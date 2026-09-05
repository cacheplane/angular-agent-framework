import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { codeToHtml } from 'shiki';
import type {
  CapabilityPresentation,
  WorkspacePresentation,
} from './workspace-presentation';
import {
  type DocSection,
  extractTsDocSections,
  extractPyDocSections,
} from './extract-docs';
import { renderMarkdown } from './render-markdown';

/**
 * Paths in the manifest are repo-root-relative (e.g., "apps/cockpit/src/app/page.tsx").
 * Next.js / Turbopack may change CWD at runtime, so we find the workspace root
 * by walking up from CWD until we find nx.json (the Nx workspace marker).
 */
export function findWorkspaceRoot(startDir: string = process.cwd()): string {
  let dir = resolve(startDir);
  while (true) {
    if (existsSync(join(dir, 'nx.json'))) return dir;
    const parent = resolve(dir, '..');
    if (parent === dir) return resolve(startDir);
    dir = parent;
  }
}

export interface NarrativeDoc {
  title: string;
  html: string;
  sourceFile: string;
}

export interface ContentBundle {
  codeFiles: Record<string, string>;
  /** Raw text of every readable code or backend asset, keyed like codeFiles. */
  codeSources: Record<string, string>;
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

  const baseUrl =
    process.env['NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL'] ??
    'https://examples.threadplane.ai';

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
  mjs: 'javascript',
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

export function resolveWorkspaceAssetPath(
  workspaceRoot: string,
  assetPath: string
): string | null {
  if (isAbsolute(assetPath)) return null;

  const resolvedRoot = resolve(workspaceRoot);
  const resolvedAsset = resolve(resolvedRoot, assetPath);
  const relativeAsset = relative(resolvedRoot, resolvedAsset);
  if (
    relativeAsset === '..' ||
    relativeAsset.startsWith(`..${sep}`) ||
    isAbsolute(relativeAsset)
  ) {
    return null;
  }

  return resolvedAsset;
}

function readFileSafe(workspaceRoot: string, filePath: string): string | null {
  const resolvedPath = resolveWorkspaceAssetPath(workspaceRoot, filePath);
  if (!resolvedPath) return null;

  try {
    return readFileSync(resolvedPath, 'utf-8');
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
      themes: { light: 'github-light', dark: 'tokyo-night' },
    });
  } catch {
    return `<pre><code>${escapeHtml(source)}</code></pre>`;
  }
}

export async function getContentBundle(
  presentation: CapabilityPresentation | WorkspacePresentation
): Promise<ContentBundle> {
  if (presentation.kind === 'docs-only') {
    return {
      codeFiles: {},
      codeSources: {},
      promptFiles: {},
      runtimeUrl: null,
      docSections: [],
      narrativeDocs: [],
    };
  }

  const workspaceRoot = findWorkspaceRoot();
  const backendPaths = presentation.backendAssetPaths ?? [];
  const allCodePaths = [...presentation.codeAssetPaths, ...backendPaths];
  const docSections: DocSection[] = [];

  const codeFiles: Record<string, string> = {};
  const codeSources: Record<string, string> = {};
  for (const path of allCodePaths) {
    const source = readFileSafe(workspaceRoot, path);
    if (source === null) {
      codeFiles[path] = `File not found: ${path}`;
    } else {
      codeFiles[path] = await highlightCode(source, path);
      codeSources[path] = source;

      // Extract doc sections
      const fileName = path.split('/').pop() ?? path;
      if (
        path.endsWith('.ts') ||
        path.endsWith('.tsx') ||
        path.endsWith('.mjs')
      ) {
        docSections.push(...extractTsDocSections(source, fileName));
      } else if (path.endsWith('.py')) {
        docSections.push(...extractPyDocSections(source, fileName));
      }
    }
  }

  const promptFiles: Record<string, string> = {};
  for (const path of presentation.promptAssetPaths) {
    const source = readFileSafe(workspaceRoot, path);
    promptFiles[path] = source ?? `File not found: ${path}`;
  }

  const runtimeUrl = resolveRuntimeUrl({
    runtimeUrl: presentation.runtimeUrl,
    devPort: presentation.devPort,
  });

  const narrativeDocs: NarrativeDoc[] = [];
  const docPaths = presentation.docsAssetPaths ?? [];
  for (const path of docPaths) {
    const source = readFileSafe(workspaceRoot, path);
    if (source) {
      try {
        const rendered = await renderMarkdown(source);
        const fileName = path.split('/').pop() ?? path;
        narrativeDocs.push({
          title: rendered.title,
          html: rendered.html,
          sourceFile: fileName,
        });
      } catch {
        // A broken narrative asset must not prevent the rest of the Cockpit
        // bundle, or later valid narratives, from loading.
      }
    }
  }

  return {
    codeFiles,
    codeSources,
    promptFiles,
    runtimeUrl,
    docSections,
    narrativeDocs,
  };
}
