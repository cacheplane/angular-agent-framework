import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { tokens } from '@threadplane/design-tokens';
import { DocsSidebar } from '../../../../../components/docs/DocsSidebar';
import { MdxRenderer } from '../../../../../components/docs/MdxRenderer';
import { DocsSearch } from '../../../../../components/docs/DocsSearch';
import { DocsBreadcrumb } from '../../../../../components/docs/DocsBreadcrumb';
import { DocsPrevNext } from '../../../../../components/docs/DocsPrevNext';
import { getDocBySlug, getAllDocSlugs, getDocMetadata } from '../../../../../lib/docs';
import { ApiDocRenderer, type ApiDocEntry } from '../../../../../components/docs/ApiDocRenderer';
import { DocsTOC } from '../../../../../components/docs/DocsTOC';
import { extractHeadings } from '../../../../../lib/extract-headings';
import { getLibraryConfig, type LibraryId } from '../../../../../lib/docs-config';
import fs from 'fs';
import path from 'path';

function loadApiDocs(library: string): ApiDocEntry[] {
  const candidates = [
    path.join(process.cwd(), 'apps', 'website', 'content', 'docs', library, 'api', 'api-docs.json'),
    path.join(process.cwd(), 'content', 'docs', library, 'api', 'api-docs.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  return [];
}

const API_NAME_MAP: Record<string, Record<string, string>> = {
  agent: {
    'agent': 'agent',
    'provide-agent': 'provideAgent',
    'fetch-stream-transport': 'FetchStreamTransport',
    'mock-stream-transport': 'MockAgentTransport',
  },
};

interface DocsRouteProps {
  params: Promise<{ library: string; section: string; slug: string }>;
}

export function generateStaticParams() {
  return getAllDocSlugs().map(({ library, section, slug }) => ({ library, section, slug }));
}

export async function generateMetadata({ params }: DocsRouteProps): Promise<Metadata> {
  const { library, section, slug } = await params;
  return getDocMetadata(library, section, slug) ?? {
    title: 'Docs - Threadplane',
    description: 'Threadplane documentation',
  };
}

export default async function DocsPage({ params }: DocsRouteProps) {
  const { library, section, slug } = await params;

  const libConfig = getLibraryConfig(library);
  if (!libConfig) notFound();

  const doc = getDocBySlug(library, section, slug);
  if (!doc) notFound();

  return (
    <div
      className="flex min-h-screen overflow-x-hidden"
      style={{ background: tokens.surfaces.canvas, paddingTop: 80 }}
    >
      <DocsSearch library={library as LibraryId} />
      <DocsSidebar activeLibrary={library as LibraryId} activeSection={section} activeSlug={slug} />
      <div
        className="flex-1 flex min-w-0"
        style={{ background: tokens.surfaces.surface }}
      >
        <div className="flex-1 min-w-0">
          <div className="px-6 md:px-12 pt-6">
            <DocsBreadcrumb library={library as LibraryId} section={section} slug={slug} title={doc.title} />
          </div>
          <article className="flex-1 py-8 px-4 sm:px-6 md:px-12 md:max-w-3xl overflow-x-hidden">
            <MdxRenderer
              source={doc.content}
              library={library as LibraryId}
              section={section}
              slug={slug}
              title={doc.title}
            />
          </article>
          {section === 'api' && (() => {
            const entries = loadApiDocs(library);
            const nameMap = API_NAME_MAP[library] ?? {};
            const target = nameMap[slug];
            const apiEntry = target ? entries.find((e: ApiDocEntry) => e.name === target) : null;
            return apiEntry ? (
              <div className="px-6 md:px-12 max-w-3xl pb-8">
                <ApiDocRenderer entry={apiEntry} />
              </div>
            ) : null;
          })()}
          <div className="px-6 md:px-12 max-w-3xl pb-8">
            <DocsPrevNext library={library as LibraryId} section={section} slug={slug} />
          </div>
        </div>
        <DocsTOC headings={extractHeadings(doc.content)} />
      </div>
    </div>
  );
}
