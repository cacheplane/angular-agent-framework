import { MDXRemote } from 'next-mdx-remote/rsc';
import { tokens } from '../../../lib/design-tokens';
import { Callout } from './mdx/Callout';
import { Steps, Step } from './mdx/Steps';
import { Tabs, Tab } from './mdx/Tabs';
import { Card, CardGroup } from './mdx/Card';
import { CodeGroup } from './mdx/CodeGroup';
import { DocsBreadcrumb } from './DocsBreadcrumb';
import { DocsPrevNext } from './DocsPrevNext';
import rehypePrettyCode from 'rehype-pretty-code';

const mdxComponents = {
  Callout,
  Steps,
  Step,
  Tabs,
  Tab,
  Card,
  CardGroup,
  CodeGroup,
};

const rehypeOptions = {
  theme: 'tokyo-night',
  keepBackground: true,
};

interface NewProps {
  source: string;
  section: string;
  slug: string;
  title: string;
}

export function MdxRendererNew({ source, section, slug, title }: NewProps) {
  return (
    <div className="flex-1 py-8 px-6 md:px-12 max-w-3xl">
      <DocsBreadcrumb section={section} title={title} />
      <article className="docs-prose prose prose-slate max-w-none"
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
              rehypePlugins: [[rehypePrettyCode, rehypeOptions] as any],
            },
          }}
        />
      </article>
      <DocsPrevNext section={section} slug={slug} />
    </div>
  );
}
