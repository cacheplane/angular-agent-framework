import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { tokens } from '@threadplane/design-tokens';
import { MdxRenderer } from '../../../components/docs/MdxRenderer';
import { DocsTOC } from '../../../components/docs/DocsTOC';
import { AuthorByline } from '../../../components/blog/AuthorByline';
import { TagChips } from '../../../components/blog/TagChips';
import { Eyebrow } from '../../../components/ui/Eyebrow';
import { getAllPosts, getPostBySlug, formatPostDate, readingTimeMin } from '../../../lib/blog';
import { getAuthor } from '../../../lib/blog-authors';
import { extractHeadings } from '../../../lib/extract-headings';
import { createPageMetadata } from '../../../lib/site-metadata';
import { getRouteLastModified, publishedDate } from '../../../lib/sitemap-dates';

interface Params {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post || post.frontmatter.draft) {
    return { title: 'Post not found — Threadplane' };
  }
  const author = getAuthor(post.frontmatter.author);
  const pathname = `/blog/${post.slug}`;
  // The post is already resolved, so index just it: no drafts policy to inherit
  // and no second read of the blog directory.
  const lastModified = getRouteLastModified(pathname, new Map([[pathname, post]]));
  // Undefined for an unparseable frontmatter date, which drops the article
  // block rather than shipping the bad string as `article:published_time`.
  const published = publishedDate(post);

  return createPageMetadata({
    title: `${post.frontmatter.title} — Threadplane`,
    description: post.frontmatter.description,
    pathname,
    type: 'article',
    // TODO(task 9): set image to "<pathname>/opengraph-image" once that route
    // exists; naming it before then would emit an og:image URL that 404s.
    article: published
      ? {
          publishedTime: published.toISOString(),
          modifiedTime: lastModified?.toISOString(),
          authors: [author.name],
          tags: post.frontmatter.tags,
        }
      : undefined,
  });
}


export default async function BlogPostPage({ params }: Params) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post || post.frontmatter.draft) notFound();
  const author = getAuthor(post.frontmatter.author);
  const minutes = readingTimeMin(post.content);
  const primaryTag = post.frontmatter.tags?.[0]
    ? post.frontmatter.tags[0].toUpperCase()
    : 'POST';
  const headings = extractHeadings(post.content);

  return (
    <div style={{ paddingTop: 80, background: tokens.surfaces.canvas, minHeight: '100vh' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          maxWidth: 1280,
          margin: '0 auto',
          gap: 0,
        }}
      >
      <article style={{ width: '100%', maxWidth: 768, padding: '64px 24px', flexShrink: 0 }}>
        <header style={{ marginBottom: 48 }}>
          <Eyebrow tone="accent" style={{ marginBottom: 24 }}>
            {primaryTag} · {formatPostDate(post.frontmatter.date)} · {minutes} min read
          </Eyebrow>
          <h1
            style={{
              fontFamily: tokens.typography.h1.family,
              fontSize: tokens.typography.h1.size,
              lineHeight: tokens.typography.h1.line,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: tokens.colors.textPrimary,
              margin: '0 0 24px',
            }}
          >
            {post.frontmatter.title}
          </h1>
          <p
            style={{
              fontFamily: tokens.typography.bodyLg.family,
              fontSize: tokens.typography.bodyLg.size,
              lineHeight: tokens.typography.bodyLg.line,
              color: tokens.colors.textSecondary,
              margin: '0 0 32px',
              maxWidth: '60ch',
            }}
          >
            {post.frontmatter.description}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', marginBottom: 20 }}>
            <AuthorByline author={author} />
          </div>
          {post.frontmatter.tags && post.frontmatter.tags.length > 0 ? (
            <TagChips tags={post.frontmatter.tags} />
          ) : null}
        </header>
        <MdxRenderer
          source={post.content}
          library="langgraph"
          section="blog"
          slug={post.slug}
          title={post.frontmatter.title}
        />
      </article>
        <DocsTOC headings={headings} />
      </div>
    </div>
  );
}
