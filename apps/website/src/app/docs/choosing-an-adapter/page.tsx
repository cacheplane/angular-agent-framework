import fs from 'fs';
import path from 'path';
import { notFound } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
import rehypePrettyCode from 'rehype-pretty-code';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';
import { tokens } from '@threadplane/design-tokens';
import { Container } from '../../../components/ui/Container';
import { Section } from '../../../components/ui/Section';
import { Eyebrow } from '../../../components/ui/Eyebrow';
import { Callout } from '../../../components/docs/mdx/Callout';
import { Steps, Step } from '../../../components/docs/mdx/Steps';
import { Tabs, Tab } from '../../../components/docs/mdx/Tabs';
import { Card, CardGroup } from '../../../components/docs/mdx/Card';
import { CodeGroup } from '../../../components/docs/mdx/CodeGroup';
import { Pre } from '../../../components/docs/mdx/CodeBlock';
import { mdxHeadingComponents } from '../../../components/docs/mdx/headings';
import { createPageMetadata } from '../../../lib/site-metadata';
import { stripFrontmatter } from '../../../lib/docs';

export const metadata = createPageMetadata({
  title: 'Choosing an adapter — Threadplane',
  description: 'Decide between @threadplane/langgraph and @threadplane/ag-ui.',
  pathname: '/docs/choosing-an-adapter',
  type: 'website',
});

const mdxComponents = {
  Callout,
  Steps,
  Step,
  Tabs,
  Tab,
  Card,
  CardGroup,
  CodeGroup,
  pre: Pre,
  table: ({ children, ...rest }: React.HTMLAttributes<HTMLTableElement>) => (
    <div className="docs-table-scroll">
      <table {...rest}>{children}</table>
    </div>
  ),
  ...mdxHeadingComponents,
};

const rehypeOptions = {
  theme: 'tokyo-night',
  keepBackground: true,
};

function resolveContentFile(): string | null {
  const candidates = [
    path.join(process.cwd(), 'apps', 'website', 'content', 'docs', 'choosing-an-adapter', 'index.mdx'),
    path.join(process.cwd(), 'content', 'docs', 'choosing-an-adapter', 'index.mdx'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export default function ChoosingAnAdapterPage() {
  const filePath = resolveContentFile();
  if (!filePath) notFound();

  const raw = fs.readFileSync(filePath, 'utf8');
  const source = stripFrontmatter(raw);

  return (
    <>
      <Section surface="canvas" ariaLabelledBy="choosing-an-adapter-heading">
        <Container>
          <div className="adapter-hero-inner">
            <Eyebrow tone="accent" className="adapter-eyebrow-spaced">
              Documentation
            </Eyebrow>
            <div id="choosing-an-adapter-heading" />
          </div>
        </Container>
      </Section>

      <Section surface="canvas">
        <Container>
          <article
            className="docs-prose prose prose-slate max-w-none adapter-article"
            style={
              {
                '--tw-prose-body': tokens.colors.textSecondary,
                '--tw-prose-headings': tokens.colors.textPrimary,
                '--tw-prose-code': tokens.colors.accent,
                '--tw-prose-links': tokens.colors.accent,
              } as React.CSSProperties
            }
          >
            <MDXRemote
              source={source}
              components={mdxComponents}
              options={{
                mdxOptions: {
                  remarkPlugins: [remarkGfm],
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  rehypePlugins: [rehypeSlug, [rehypePrettyCode, rehypeOptions] as any],
                },
              }}
            />
          </article>
        </Container>
      </Section>
    </>
  );
}
