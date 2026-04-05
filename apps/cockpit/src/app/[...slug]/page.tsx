import { redirect } from 'next/navigation';
import { CockpitShell } from '../../components/cockpit-shell';
import { getContentBundle } from '../../lib/content-bundle';
import { cockpitManifest, getCockpitPageModel } from '../../lib/cockpit-page';

export async function generateStaticParams() {
  return cockpitManifest.map((entry) => ({
    slug: [entry.product, entry.section, entry.topic, entry.page, entry.language],
  }));
}

export default async function CockpitRoutePage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug = [] } = await params;
  const { entry, presentation, navigationTree, canonicalPath } =
    getCockpitPageModel(slug);
  const requestedPath = `/${slug.join('/')}`;

  if (slug.length > 0 && requestedPath !== canonicalPath) {
    redirect(canonicalPath);
  }

  const contentBundle = await getContentBundle(presentation);

  return (
    <CockpitShell
      navigationTree={navigationTree}
      presentation={presentation}
      entryTitle={entry.title}
      contentBundle={contentBundle}
    />
  );
}
