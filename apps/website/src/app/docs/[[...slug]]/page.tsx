import { notFound } from 'next/navigation';
import { DocsSidebar } from '../../../components/docs/DocsSidebar';
import { MdxRenderer } from '../../../components/docs/MdxRenderer';
import { OpenInCockpit } from '../../../components/docs/open-in-cockpit';
import { getDocBySlug, getAllDocSlugs, getPromptBySlug } from '../../../lib/docs';

export function generateStaticParams() {
  return getAllDocSlugs().map((slug) => ({ slug }));
}

export default async function DocsPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug: rawSlug } = await params;
  const slug = rawSlug ?? ['deep-agents', 'getting-started', 'overview', 'overview', 'python'];
  const doc = getDocBySlug(slug);
  if (!doc) notFound();
  const prompt = getPromptBySlug(slug) ?? undefined;

  return (
    <div className="flex min-h-screen pt-16"
      style={{ background: 'var(--gradient-bg-flow)' }}>
      <DocsSidebar activeSlug={slug.join('/')} />
      <div className="flex-1">
        <div className="px-8 pt-8">
          <OpenInCockpit bundle={doc.bundle} />
        </div>
        <MdxRenderer source={doc.content} prompt={prompt} />
      </div>
    </div>
  );
}
