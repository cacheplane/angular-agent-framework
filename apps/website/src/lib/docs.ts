import fs from 'fs';
import path from 'path';
import type { Metadata } from 'next';
import { docsConfig, type DocsPage, getLibraryConfig, getLibraryPages } from './docs-config';
import { createPageMetadata } from './site-metadata';

const resolveContentDir = (library: string): string => {
  const workspacePath = path.join(process.cwd(), 'apps', 'website', 'content', 'docs', library);
  if (fs.existsSync(workspacePath)) return workspacePath;
  return path.join(process.cwd(), 'content', 'docs', library);
};

export interface ResolvedDoc {
  page: DocsPage;
  content: string;
  title: string;
}

export type ResolvedDocMetadata = Metadata;

const FRONTMATTER_DESCRIPTION_PATTERN = /^---\s*\n[\s\S]*?\ndescription:\s*['"]?(?<description>[^'"\n]+)['"]?\s*\n[\s\S]*?\n---/;

function normalizeDescription(description: string): string {
  return description
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractFirstParagraph(content: string): string | null {
  const withoutFrontmatter = content.replace(/^---\s*\n[\s\S]*?\n---\s*/, '');
  const withoutImports = withoutFrontmatter.replace(/^import\s.+$/gm, '');
  const paragraphs = withoutImports.split(/\n{2,}/);

  for (const paragraph of paragraphs) {
    const normalized = normalizeDescription(paragraph);
    if (
      normalized.length < 40 ||
      normalized.startsWith('#') ||
      normalized.startsWith('|') ||
      normalized.startsWith('```') ||
      normalized.startsWith('<')
    ) {
      continue;
    }

    return normalized.length > 180 ? `${normalized.slice(0, 177).trimEnd()}...` : normalized;
  }

  return null;
}

function getDocDescription(content: string, fallback: string): string {
  const frontmatterDescription = content.match(FRONTMATTER_DESCRIPTION_PATTERN)?.groups?.description;
  if (frontmatterDescription) return normalizeDescription(frontmatterDescription);
  return extractFirstParagraph(content) ?? fallback;
}

export function getDocBySlug(library: string, section: string, slug: string): ResolvedDoc | null {
  const pages = getLibraryPages(library);
  const page = pages.find((p) => p.section === section && p.slug === slug);
  if (!page) return null;

  const dir = resolveContentDir(library);
  const filePath = path.join(dir, section, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;

  const content = fs.readFileSync(filePath, 'utf8');
  const titleMatch = content.match(/^#\s+(.+)$/m);
  return {
    page,
    content,
    title: titleMatch?.[1] ?? page.title,
  };
}

export function getDocMetadata(
  library: string,
  section: string,
  slug: string
): ResolvedDocMetadata | null {
  const doc = getDocBySlug(library, section, slug);
  if (!doc) return null;

  const lib = getLibraryConfig(library);
  const libraryTitle = lib?.title ?? 'Docs';
  const title = `${doc.title} - ${libraryTitle} Docs - Threadplane`;
  const description = getDocDescription(doc.content, lib?.description ?? 'Threadplane documentation');
  const pathname = `/docs/${library}/${section}/${slug}`;

  return createPageMetadata({ title, description, pathname });
}

export function getAllDocSlugs(): { library: string; section: string; slug: string }[] {
  return docsConfig.flatMap((lib) =>
    lib.sections.flatMap((s) =>
      s.pages.map((p) => ({ library: lib.id, section: p.section, slug: p.slug }))
    )
  );
}
