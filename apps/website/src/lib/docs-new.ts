import fs from 'fs';
import path from 'path';
import { allDocsPages, type DocsPage } from './docs-config';

const resolveContentDir = (): string => {
  const workspacePath = path.join(process.cwd(), 'apps', 'website', 'content', 'docs-v2');
  if (fs.existsSync(workspacePath)) return workspacePath;
  return path.join(process.cwd(), 'content', 'docs-v2');
};

export interface ResolvedDoc {
  page: DocsPage;
  content: string;
  title: string;
}

export function getDocBySlug(section: string, slug: string): ResolvedDoc | null {
  const page = allDocsPages.find((p) => p.section === section && p.slug === slug);
  if (!page) return null;

  const dir = resolveContentDir();
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

export function getAllDocSlugs(): { section: string; slug: string }[] {
  return allDocsPages.map((p) => ({ section: p.section, slug: p.slug }));
}
