import rehypePrettyCode from 'rehype-pretty-code';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';

const rehypeOptions = {
  theme: 'tokyo-night',
  keepBackground: true,
};

/**
 * The one MDX compile configuration. `MdxRenderer` uses it for whole pages and
 * `ExampleCode` for the fence it synthesizes, so included code is highlighted
 * and styled exactly like a hand-written block.
 */
export const mdxCompileOptions = {
  mdxOptions: {
    remarkPlugins: [remarkGfm],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rehypePlugins: [rehypeSlug, [rehypePrettyCode, rehypeOptions] as any],
  },
};
