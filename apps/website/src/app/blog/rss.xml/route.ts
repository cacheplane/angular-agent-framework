import { NextResponse } from 'next/server';
import { getAllPosts } from '../../../lib/blog';
import { SITE_ORIGIN } from '../../../lib/site-metadata';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function GET() {
  const posts = getAllPosts();
  const items = posts
    .map((p) => {
      const url = `${SITE_ORIGIN}/blog/${p.slug}`;
      const pubDate = (() => {
        const d = new Date(p.frontmatter.date);
        return Number.isNaN(d.getTime()) ? '' : d.toUTCString();
      })();
      return `    <item>
      <title><![CDATA[${p.frontmatter.title}]]></title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${p.frontmatter.description}]]></description>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml('ThreadPlane Blog')}</title>
    <link>${SITE_ORIGIN}/blog</link>
    <atom:link href="${SITE_ORIGIN}/blog/rss.xml" rel="self" type="application/rss+xml" />
    <description>${escapeXml('Writing on agent UI for Angular.')}</description>
    <language>en</language>
${items}
  </channel>
</rss>
`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  });
}
