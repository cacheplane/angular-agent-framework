import { MDXRemote } from 'next-mdx-remote/rsc';
import { CopyPromptButton } from './CopyPromptButton';
import { tokens } from '../../../lib/design-tokens';

interface Props {
  source: string;
  prompt?: string;
}

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
