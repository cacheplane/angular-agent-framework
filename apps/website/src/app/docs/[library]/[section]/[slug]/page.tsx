import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { tokens } from '@threadplane/design-tokens';
import { DocsSidebar } from '../../../../../components/docs/DocsSidebar';
import { MdxRenderer } from '../../../../../components/docs/MdxRenderer';
import { DocsSearch } from '../../../../../components/docs/DocsSearch';
import { DocsBreadcrumb } from '../../../../../components/docs/DocsBreadcrumb';
import { DocsPageHeader } from '../../../../../components/docs/DocsPageHeader';
import { PageActions } from '../../../../../components/docs/PageActions';
import { DocsPrevNext } from '../../../../../components/docs/DocsPrevNext';
import { getDocBySlug, getAllDocSlugs, getDocMetadata, resolveDocDescription } from '../../../../../lib/docs';
import { JsonLd } from '../../../../../components/shared/JsonLd';
import { breadcrumbJsonLd, techArticleJsonLd } from '../../../../../lib/structured-data';
import { getRouteLastModified } from '../../../../../lib/sitemap-dates';
import { ApiDocRenderer, type ApiDocEntry } from '../../../../../components/docs/ApiDocRenderer';
import { DocsTOC } from '../../../../../components/docs/DocsTOC';
import { extractHeadings } from '../../../../../lib/extract-headings';
import { findDocsPage, getLibraryConfig, type LibraryId } from '../../../../../lib/docs-config';
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

interface DocsRouteProps {
  params: Promise<{ library: string; section: string; slug: string }>;
}

export function generateStaticParams() {
  return getAllDocSlugs().map(({ library, section, slug }) => ({ library, section, slug }));
}

export async function generateMetadata({ params }: DocsRouteProps): Promise<Metadata> {
  const { library, section, slug } = await params;
  return getDocMetadata(library, section, slug) ?? {
    title: 'Docs — Threadplane',
    description: 'Threadplane documentation',
  };
}

export default async function DocsPage({ params }: DocsRouteProps) {
  const { library, section, slug } = await params;

  const libConfig = getLibraryConfig(library);
  if (!libConfig) notFound();

  const doc = getDocBySlug(library, section, slug);
  if (!doc) notFound();

  const pathname = `/docs/${library}/${section}/${slug}`;
  // The empty post index is the honest one here: `getRouteLastModified` consults
  // it only to recognise a blog route, and no /docs route is ever a post, so
  // passing an index costs a blog-directory read and changes nothing. The
  // sitemap resolves this same route through the same file-source path, so the
  // two `dateModified` claims agree.
  const lastModified = getRouteLastModified(pathname, new Map());

  return (
    <div
      className="flex min-h-screen overflow-x-hidden"
      style={{ background: tokens.surfaces.canvas, paddingTop: 80 }}
    >
      <JsonLd
        data={techArticleJsonLd({
          title: doc.title,
          // Exactly the string `generateMetadata` puts in the meta description.
          description: resolveDocDescription(doc, library),
          pathname,
          dateModified: lastModified?.toISOString(),
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Docs', pathname: '/docs' },
          // Mirrors the visible <DocsBreadcrumb>, which links the library at its
          // introduction page: there is no /docs/<library> route (no page.tsx
          // under src/app/docs/[library], and it is absent from the sitemap), so
          // the plan's `/docs/${library}` would point a crumb at a 404.
          //
          // The section rung the visible trail shows between library and page is
          // deliberately absent: it is plain text there because no section index
          // route exists, and a non-final BreadcrumbList item with no `item` URL
          // is invalid. Omitting it is closer to the visible trail than inventing
          // a URL for it.
          { name: libConfig.title, pathname: `/docs/${library}/getting-started/introduction` },
          { name: doc.title, pathname },
        ])}
      />
      <DocsSearch library={library as LibraryId} />
      <DocsSidebar activeLibrary={library as LibraryId} activeSection={section} activeSlug={slug} />
      <div
        className="flex-1 flex min-w-0"
        style={{ background: tokens.surfaces.surface }}
      >
        <div className="flex-1 min-w-0">
          <div className="px-6 md:px-12 pt-6">
            <DocsBreadcrumb library={library as LibraryId} section={section} slug={slug} title={doc.title} />
            <DocsPageHeader
              library={library as LibraryId}
              section={section}
              actions={<PageActions library={library} section={section} slug={slug} />}
            />
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
            const target = doc.title.replace(/\(\)$/, '');
            const byName = (name: string) =>
              entries.find((e: ApiDocEntry) => e.name === name);

            // A page normally documents the one export named by its H1. Pages
            // covering a group of exports declare them via `apiEntries`.
            const configured = findDocsPage(library, section, slug)?.apiEntries;
            const rendered = configured
              ? configured.map(byName).filter((e): e is ApiDocEntry => Boolean(e))
              : [byName(target) ?? byName(doc.title)].filter((e): e is ApiDocEntry => Boolean(e));

            return rendered.length > 0 ? (
              <div className="px-6 md:px-12 max-w-3xl pb-8">
                {rendered.map((entry) => (
                  <ApiDocRenderer key={entry.name} entry={entry} />
                ))}
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
