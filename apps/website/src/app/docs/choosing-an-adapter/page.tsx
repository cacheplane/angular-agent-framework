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
import { createPageMetadata } from '../../../lib/site-metadata';

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
  h2: ({ id, children, ...rest }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 id={id} {...rest}>
      {id ? (
        <a href={`#${id}`} aria-label={`Link to ${id}`} className="heading-anchor">
          #
        </a>
      ) : null}
      {children}
    </h2>
  ),
  h3: ({ id, children, ...rest }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 id={id} {...rest}>
      {id ? (
        <a href={`#${id}`} aria-label={`Link to ${id}`} className="heading-anchor">
          #
        </a>
      ) : null}
      {children}
    </h3>
  ),
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

function stripFrontmatter(source: string): string {
  return source.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '');
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
          <div style={{ maxWidth: 720 }}>
            <Eyebrow tone="accent" style={{ marginBottom: 16 }}>
              Documentation
            </Eyebrow>
            <div id="choosing-an-adapter-heading" />
          </div>
        </Container>
      </Section>

      <Section surface="canvas">
        <Container>
          <article
            className="docs-prose prose prose-slate max-w-none"
            style={
              {
                maxWidth: 760,
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
