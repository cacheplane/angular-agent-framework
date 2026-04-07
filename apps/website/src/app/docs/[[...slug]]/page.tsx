import { notFound } from 'next/navigation';
import { DocsSidebarNew } from '../../../components/docs/DocsSidebarNew';
import { MdxRendererNew } from '../../../components/docs/MdxRenderer';
import { DocsSearch } from '../../../components/docs/DocsSearch';
import { getDocBySlug, getAllDocSlugs } from '../../../lib/docs-new';
import { ApiDocRenderer, type ApiDocEntry } from '../../../components/docs/ApiDocRenderer';
import { DocsTOC } from '../../../components/docs/DocsTOC';
import { DocsMobileNav } from '../../../components/docs/DocsMobileNav';
import { extractHeadings } from '../../../lib/extract-headings';
import fs from 'fs';
import path from 'path';

function loadApiDocs(): ApiDocEntry[] {
  const candidates = [
    path.join(process.cwd(), 'apps', 'website', 'content', 'docs-v2', 'api', 'api-docs.json'),
    path.join(process.cwd(), 'content', 'docs-v2', 'api', 'api-docs.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  return [];
}

const API_NAME_MAP: Record<string, string> = {
  'angular': 'agent',
  'provide-angular': 'provideAgent',
  'fetch-stream-transport': 'FetchStreamTransport',
  'mock-stream-transport': 'MockAgentTransport',
};

export function generateStaticParams() {
  return getAllDocSlugs().map(({ section, slug }) => ({ slug: [section, slug] }));
}

export default async function DocsPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug: rawSlug } = await params;
  const slugParts = rawSlug ?? ['getting-started', 'introduction'];

  const [section, slug] = slugParts.length >= 2
    ? [slugParts[0], slugParts[1]]
    : ['getting-started', 'introduction'];

  const doc = getDocBySlug(section, slug);
  if (!doc) notFound();

  return (
    <div className="flex min-h-screen pt-16 overflow-x-hidden" style={{ background: 'var(--gradient-bg-flow)' }}>
      <DocsSearch />
      <DocsSidebarNew activeSection={section} activeSlug={slug} />
      <div className="flex-1 flex min-w-0" style={{ background: 'rgba(255, 255, 255, 0.85)' }}>
        <div className="flex-1 min-w-0">
          <div className="px-4 pt-4 sm:hidden">
            <DocsMobileNav activeSection={section} activeSlug={slug} />
          </div>
          <MdxRendererNew source={doc.content} section={section} slug={slug} title={doc.title} />
          {section === 'api' && (() => {
            const entries = loadApiDocs();
            const target = API_NAME_MAP[slug];
            const apiEntry = target ? entries.find((e: ApiDocEntry) => e.name === target) : null;
            return apiEntry ? (
              <div className="px-6 md:px-12 max-w-3xl pb-8">
                <ApiDocRenderer entry={apiEntry} />
              </div>
            ) : null;
          })()}
        </div>
        <DocsTOC headings={extractHeadings(doc.content)} />
      </div>
    </div>
  );
}
