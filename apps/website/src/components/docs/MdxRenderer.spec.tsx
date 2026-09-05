import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { MdxRenderer } from './MdxRenderer';

function findMdx(
  node: ReactNode
): ReactElement<{ components: Record<string, unknown> }> | null {
  if (
    !isValidElement<{
      components: Record<string, unknown>;
      children?: ReactNode;
    }>(node)
  )
    return null;
  if (node.type === MDXRemote) return node;
  return findMdx(node.props.children);
}

describe('MdxRenderer', () => {
  it('always registers ExampleCode, bound to the page context', () => {
    const withContext = findMdx(
      MdxRenderer({
        source: '# x',
        exampleCode: {
          docsPath: '/docs/p',
          assetPaths: ['a/b.ts'],
          sources: { 'a/b.ts': '' },
        },
      })
    );
    const without = findMdx(MdxRenderer({ source: '# x' }));

    expect(typeof withContext?.props.components['ExampleCode']).toBe(
      'function'
    );
    expect(typeof without?.props.components['ExampleCode']).toBe('function');
    expect(() =>
      (
        without?.props.components['ExampleCode'] as (p: {
          file: string;
        }) => unknown
      )({ file: 'b.ts' })
    ).toThrow(/mapped example/);
  });
});
