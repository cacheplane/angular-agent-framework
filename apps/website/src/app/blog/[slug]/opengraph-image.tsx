import { ImageResponse } from 'next/og';
import { getPostBySlug } from '../../../lib/blog';
import { getAuthor } from '../../../lib/blog-authors';
import { loadGoogleFont, loadLocalGaramond, satoriFonts } from '../../og-font';

export const runtime = 'nodejs';
export const alt = 'Threadplane blog post';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

interface Params {
  params: Promise<{ slug: string }>;
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

  const [garamondBold, interRegular, interBold] = await Promise.all([
    loadLocalGaramond(),
    loadGoogleFont('Inter', 400),
    loadGoogleFont('Inter', 600),
  ]);
  const fonts = satoriFonts([
    garamondBold && { name: 'EB Garamond', data: garamondBold, weight: 700 as const, style: 'normal' as const },
    interRegular && { name: 'Inter', data: interRegular, weight: 400 as const, style: 'normal' as const },
    interBold && { name: 'Inter', data: interBold, weight: 600 as const, style: 'normal' as const },
  ]);

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
            display: 'flex',
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
            display: 'flex',
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
          child node, and throws (→ HTTP 500) otherwise. This byline has three
          (name, separator, date), so the `display: flex` is load-bearing.
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
