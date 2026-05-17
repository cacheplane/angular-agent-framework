import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MdxRenderer } from '../../../components/docs/MdxRenderer';
import { AuthorByline } from '../../../components/blog/AuthorByline';
import { getAllPosts, getPostBySlug } from '../../../lib/blog';
import { getAuthor } from '../../../lib/blog-authors';
import { createPageMetadata } from '../../../lib/site-metadata';

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
    return { title: 'Post not found — Cacheplane' };
  }
  return createPageMetadata({
    title: `${post.frontmatter.title} — Cacheplane`,
    description: post.frontmatter.description,
    pathname: `/blog/${post.slug}`,
    type: 'article',
  });
}

export default async function BlogPostPage({ params }: Params) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post || post.frontmatter.draft) notFound();
  const author = getAuthor(post.frontmatter.author);
  return (
    <article style={{ maxWidth: 768, margin: '0 auto', padding: '64px 24px' }}>
      <header style={{ marginBottom: 32 }}>
        <time
          dateTime={post.frontmatter.date}
          style={{ fontSize: 14, opacity: 0.7 }}
        >
          {post.frontmatter.date}
        </time>
        <h1
          style={{
            fontSize: 44,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            margin: '12px 0 16px',
            lineHeight: 1.15,
          }}
        >
          {post.frontmatter.title}
        </h1>
        <AuthorByline author={author} />
      </header>
      <MdxRenderer
        source={post.content}
        library="agent"
        section="blog"
        slug={post.slug}
        title={post.frontmatter.title}
      />
    </article>
  );
}
