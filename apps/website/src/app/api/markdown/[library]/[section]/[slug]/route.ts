import { NextResponse } from 'next/server';
import { getDocBySlug, getAllDocSlugs } from '../../../../../../lib/docs';

export function generateStaticParams() {
  return getAllDocSlugs();
}

interface RouteContext {
  params: Promise<{ library: string; section: string; slug: string }>;
}

export async function GET(_req: Request, context: RouteContext): Promise<Response> {
  const { library, section, slug } = await context.params;
  const doc = getDocBySlug(library, section, slug);

  if (!doc) {
    return new NextResponse('Not found', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  return new NextResponse(doc.content, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=60, must-revalidate',
    },
  });
}
