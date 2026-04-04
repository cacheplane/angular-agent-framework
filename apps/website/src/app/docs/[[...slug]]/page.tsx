import { notFound } from 'next/navigation';
import { DocsSidebarNew } from '../../../components/docs/DocsSidebarNew';
import { MdxRendererNew } from '../../../components/docs/MdxRenderer';
import { DocsSearch } from '../../../components/docs/DocsSearch';
import { getDocBySlug, getAllDocSlugs } from '../../../lib/docs-new';

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
    <div className="flex min-h-screen pt-16" style={{ background: 'var(--gradient-bg-flow)' }}>
      <DocsSearch />
      <DocsSidebarNew activeSection={section} activeSlug={slug} />
      <div className="flex-1" style={{ background: 'rgba(255, 255, 255, 0.85)' }}>
        <MdxRendererNew source={doc.content} section={section} slug={slug} title={doc.title} />
      </div>
    </div>
  );
}
