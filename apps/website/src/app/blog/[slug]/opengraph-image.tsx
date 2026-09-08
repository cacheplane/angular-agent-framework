import { ImageResponse } from 'next/og';
import { getAllPosts, getPostBySlug } from '../../../lib/blog';
import { getAuthor } from '../../../lib/blog-authors';
import { loadCardFonts } from '../../og-font';
import { CARD } from '../../card/tokens';
import { Rail, Wordmark } from '../../card/chrome';

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
            background: CARD.ground,
            color: CARD.ink,
            fontSize: 64,
          }}
        >
          Threadplane
        </div>
      ),
      size,
    );
  }

  const fonts = await loadCardFonts({ mono: true });
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
          background: CARD.ground,
          color: CARD.ink,
          fontFamily: 'Archivo, sans-serif',
        }}
      >
        <Rail text="THREADPLANE BLOG" />
        <div
          style={{
            fontFamily: 'Archivo Black, sans-serif',
            fontSize: 64,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            color: CARD.ink,
            maxWidth: '92%',
          }}
        >
          {post.frontmatter.title}
        </div>
        {/*
          Satori requires an explicit `display` on any div with more than one
          child node, and throws otherwise. This row has two (the byline and
          the wordmark), and the byline itself has three (name, separator,
          date), so both `display: flex` are load-bearing — their absence is
          what 500ed every post's card.
        */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', fontSize: 24, color: CARD.inkMuted }}>
            {author.name} · {post.frontmatter.date}
          </div>
          <Wordmark size={30} />
        </div>
      </div>
    ),
    {
      ...size,
      fonts,
    },
  );
}
