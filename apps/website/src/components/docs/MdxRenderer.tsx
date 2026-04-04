import { MDXRemote } from 'next-mdx-remote/rsc';
import { CopyPromptButton } from './CopyPromptButton';
import { tokens } from '../../../lib/design-tokens';
import { Callout } from './mdx/Callout';
import { Steps, Step } from './mdx/Steps';
import { Tabs, Tab } from './mdx/Tabs';
import { Card, CardGroup } from './mdx/Card';
import { CodeGroup } from './mdx/CodeGroup';
import { DocsBreadcrumb } from './DocsBreadcrumb';
import { DocsPrevNext } from './DocsPrevNext';

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

interface Props {
  source: string;
  prompt?: string;
}

/** Legacy renderer for old cockpit-based docs */
export function MdxRenderer({ source, prompt }: Props) {
  return (
    <article className="prose max-w-none py-8 px-8 flex-1"
      style={{
        '--tw-prose-body': tokens.colors.textSecondary,
        '--tw-prose-headings': tokens.colors.textPrimary,
        '--tw-prose-code': tokens.colors.accent,
        background: 'rgba(255, 255, 255, 0.8)',
      } as React.CSSProperties}>
      {prompt && (
        <div style={{ marginBottom: 24 }}>
          <CopyPromptButton prompt={prompt} variant="docs" />
        </div>
      )}
      <MDXRemote source={source} />
    </article>
  );
}

interface NewProps {
  source: string;
  section: string;
  slug: string;
  title: string;
}

/** New renderer with custom MDX components, breadcrumbs, and prev/next */
export function MdxRendererNew({ source, section, slug, title }: NewProps) {
  return (
    <div className="flex-1 py-8 px-8 md:px-12 max-w-3xl">
      <DocsBreadcrumb section={section} title={title} />
      <article className="prose max-w-none"
        style={{
          '--tw-prose-body': tokens.colors.textSecondary,
          '--tw-prose-headings': tokens.colors.textPrimary,
          '--tw-prose-code': tokens.colors.accent,
          '--tw-prose-links': tokens.colors.accent,
        } as React.CSSProperties}>
        <MDXRemote source={source} components={mdxComponents} />
      </article>
      <DocsPrevNext section={section} slug={slug} />
    </div>
  );
}
