import { MDXRemote } from 'next-mdx-remote/rsc';
import {
  ExampleCodeError,
  exampleTitle,
  fenceFor,
  resolveExampleFile,
  sliceRegion,
  type ExampleCodeContext,
} from '../../../lib/example-code';
import { mdxCompileOptions } from '../mdx-options';
import { Pre } from './CodeBlock';

export interface ExampleCodeProps {
  /** Basename or repo-relative path of one of the page's example files. */
  file: string;
  /** Name of a `#region` / `#endregion` pair inside that file. */
  region?: string;
  /** Title bar text; defaults to the file's basename. */
  title?: string;
}

/**
 * Binds `<ExampleCode>` to one docs page's example. The component renders
 * the requested file (or region) as a code fence through the same MDX
 * pipeline as the page, so highlighting, the copy button and every `pre`
 * style are identical to a hand-written block. Anything unresolvable throws
 * at build time: a docs page without its code is wrong, not degraded.
 */
export function createExampleCode(context: ExampleCodeContext | null) {
  return function ExampleCode({ file, region, title }: ExampleCodeProps) {
    if (!context) {
      throw new ExampleCodeError(
        `<ExampleCode file="${file}"> is only valid on a docs page with a mapped example`
      );
    }
    const path = resolveExampleFile(file, context);
    const source = context.sources[path];
    const code = region ? sliceRegion(source, region, path) : source;
    const heading = title ?? exampleTitle(path);

    return (
      <div
        className="mdx-example-code"
        data-example-file={path}
        data-example-region={region}
        role="group"
        aria-label={heading}
      >
        <div className="mdx-example-code-title">{heading}</div>
        <MDXRemote source={fenceFor(code, path)} components={{ pre: Pre }} options={mdxCompileOptions} />
      </div>
    );
  };
}
