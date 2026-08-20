import { MDXRemote } from 'next-mdx-remote/rsc';
import { tokens } from '@threadplane/design-tokens';
import { Callout } from './mdx/Callout';
import { Steps, Step } from './mdx/Steps';
import { Tabs, Tab } from './mdx/Tabs';
import { Card, CardGroup } from './mdx/Card';
import { CodeGroup } from './mdx/CodeGroup';
import { Pre } from './mdx/CodeBlock';
import { FeatureChips } from './mdx/FeatureChips';
import { mdxHeadingComponents } from './mdx/headings';
import { ArchFlowDiagram } from './ArchFlowDiagram';
import { AgUiArchDiagram } from './AgUiArchDiagram';
import { type LibraryId } from '../../lib/docs-config';
import rehypePrettyCode from 'rehype-pretty-code';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';

const mdxComponents = {
  Callout,
  Steps,
  Step,
  Tabs,
  Tab,
  Card,
  CardGroup,
  CodeGroup,
  ArchFlowDiagram,
  AgUiArchDiagram,
  FeatureChips,
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

interface MdxRendererProps {
  source: string;
  library: LibraryId;
  section: string;
  slug: string;
  title: string;
}

export function MdxRenderer({ source, library, section, slug, title }: MdxRendererProps) {
  return (
    <div className="docs-prose prose prose-slate max-w-none"
      style={{
        '--tw-prose-body': tokens.colors.textSecondary,
        '--tw-prose-headings': tokens.colors.textPrimary,
        '--tw-prose-code': tokens.colors.accent,
        '--tw-prose-links': tokens.colors.accent,
      } as React.CSSProperties}>
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
    </div>
  );
}
