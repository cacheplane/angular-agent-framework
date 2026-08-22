import { ImageResponse } from 'next/og';
import { getAllPosts, getPostBySlug } from '../../../lib/blog';
import { getAuthor } from '../../../lib/blog-authors';
import { loadCardFonts } from '../../og-font';

export const runtime = 'nodejs';
export const alt = 'Threadplane blog post';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

interface Params {
  params: Promise<{ slug: string }>;
}

/**
 * Prerenders one card per published post at build time. Mirrors the
 * `generateStaticParams` in this segment's `page.tsx`, so drafts are excluded.
 *
 * This is load-bearing beyond the obvious caching win. Satori rejects some
 * markup at render time (a div with multiple children and no explicit
 * `display`, for one) and a request-time route turns that into a production
 * 500 on every post — which is exactly how the byline below shipped broken.
 * Prerendering promotes that whole class of mistake into a build failure.
 * It also keeps the MDX read and the Google Fonts round-trips on the build,
 * where `resolveWebsiteDir()` is known to resolve, rather than per request.
 */
export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export default async function og({ params }: Params) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post || post.frontmatter.draft) {
    // No `fonts` option at all: next/og falls back to its bundled Noto Sans.
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0b0d12',
            color: '#ffffff',
            fontSize: 64,
          }}
        >
          Threadplane
        </div>
      ),
      size,
    );
  }

  const fonts = await loadCardFonts();
  const author = getAuthor(post.frontmatter.author);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 64,
          background: '#0b0d12',
          color: '#ffffff',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        <div
          style={{
            fontSize: 24,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            opacity: 0.6,
          }}
        >
          Threadplane Blog
        </div>
        <div
          style={{
            fontFamily: 'EB Garamond, Georgia, serif',
            fontSize: 64,
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            maxWidth: '90%',
          }}
        >
          {post.frontmatter.title}
        </div>
        {/*
          Satori requires an explicit `display` on any div with more than one
          child node, and throws otherwise. This byline has three (name,
          separator, date), so the `display: flex` is load-bearing — its
          absence is what 500ed every post's card. The two divs above have a
          single child each and need no `display`.
        */}
        <div style={{ display: 'flex', fontSize: 24, opacity: 0.7 }}>
          {author.name} · {post.frontmatter.date}
        </div>
      </div>
    ),
    {
      ...size,
      fonts,
    },
  );
}
