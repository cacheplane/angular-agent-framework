import { ImageResponse } from 'next/og';
import { getPostBySlug } from '../../../lib/blog';
import { getAuthor } from '../../../lib/blog-authors';

export const runtime = 'nodejs';
export const alt = 'Threadplane blog post';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

interface Params {
  params: Promise<{ slug: string }>;
}

async function loadFont(family: string, weight: number): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' } },
    ).then((res) => res.text());
    const match = css.match(/src:\s*url\((https?:\/\/[^)]+)\)/);
    if (!match) return null;
    const fontRes = await fetch(match[1]);
    if (!fontRes.ok) return null;
    return await fontRes.arrayBuffer();
  } catch {
    return null;
  }
}

async function loadLocalGaramond(): Promise<ArrayBuffer | null> {
  try {
    const { fileURLToPath } = await import('node:url');
    const { readFile } = await import('node:fs/promises');
    const { dirname, join } = await import('node:path');
    // The TTF lives next to the root opengraph-image.tsx, one level up from blog/[slug]
    const here = dirname(fileURLToPath(import.meta.url));
    const buf = await readFile(join(here, '../../EBGaramond-Bold.ttf'));
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  } catch (err) {
    console.warn('blog/[slug]/opengraph-image: failed to load local Garamond TTF', err);
    return null;
  }
}

export default async function og({ params }: Params) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post || post.frontmatter.draft) {
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
    loadFont('Inter', 400),
    loadFont('Inter', 600),
  ]);
  const fonts = [
    garamondBold && { name: 'EB Garamond', data: garamondBold, weight: 700 as const, style: 'normal' as const },
    interRegular && { name: 'Inter', data: interRegular, weight: 400 as const, style: 'normal' as const },
    interBold && { name: 'Inter', data: interBold, weight: 600 as const, style: 'normal' as const },
  ].filter((f): f is NonNullable<typeof f> => f !== null);

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
        <div style={{ fontSize: 24, opacity: 0.7 }}>
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
