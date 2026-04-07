import fs from 'fs';
import path from 'path';
import { docsConfig, type DocsPage, getLibraryPages } from './docs-config';

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

export function getAllDocSlugs(): { library: string; section: string; slug: string }[] {
  return docsConfig.flatMap((lib) =>
    lib.sections.flatMap((s) =>
      s.pages.map((p) => ({ library: lib.id, section: p.section, slug: p.slug }))
    )
  );
}
