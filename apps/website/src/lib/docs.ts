import fs from 'fs';
import path from 'path';
import {
  getDocsBundles,
  resolveDocsBundle,
  toDocsSlug,
  type DocsBundle,
} from '@cacheplane/cockpit-docs';

const resolveContentDir = (...segments: string[]): string => {
  const workspacePath = path.join(process.cwd(), 'apps', 'website', ...segments);

  if (fs.existsSync(workspacePath)) {
    return workspacePath;
  }

  return path.join(process.cwd(), ...segments);
};

const DOCS_DIR = resolveContentDir('content', 'docs');
const PROMPTS_DIR = resolveContentDir('content', 'prompts');

export interface DocMeta {
  slug: string[];
  title: string;
}

export interface ResolvedDoc {
  bundle: DocsBundle;
  content: string;
  title: string;
}

const DEFAULT_DOC_SLUG = [
  'deep-agents',
  'getting-started',
  'overview',
  'overview',
  'python',
];

const isDocsSlug = (slug: string[]): slug is [string, string, string, string, string] =>
  slug.length === 5;

export const resolveDocBundleBySlug = (slug: string[]): DocsBundle | null => {
  const normalizedSlug = slug.length === 0 ? DEFAULT_DOC_SLUG : slug;

  if (!isDocsSlug(normalizedSlug)) {
    return null;
  }

  const [product, section, topic, page, language] = normalizedSlug;

  return resolveDocsBundle({
    product: product as DocsBundle['product'],
    section: section as DocsBundle['section'],
    topic,
    page: page as DocsBundle['page'],
    language: language as DocsBundle['language'],
  });
};

export function getAllDocSlugs(): string[][] {
  return getDocsBundles().map((bundle) => toDocsSlug(bundle));
}

export function getDocBySlug(slug: string[]): ResolvedDoc | null {
  const bundle = resolveDocBundleBySlug(slug);
  if (!bundle) return null;

  const filePath = path.join(DOCS_DIR, bundle.sourcePath);
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf8');
  const titleMatch = content.match(/^#\s+(.+)$/m);
  return {
    bundle,
    content,
    title: titleMatch?.[1] ?? bundle.title,
  };
}

export function getAllDocsMeta(): DocMeta[] {
  return getAllDocSlugs().map((slug) => {
    const doc = getDocBySlug(slug);
    return { slug, title: doc?.title ?? slug[2] ?? slug[0] };
  });
}

export function getPromptBySlug(slug: string[]): string | null {
  if (slug.length === 5 && slug[3] === 'prompts') {
    const doc = getDocBySlug(slug);
    return doc?.content ?? null;
  }

  const filePath = path.join(PROMPTS_DIR, `${slug.join('/')}.md`);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf8').trim();
}
