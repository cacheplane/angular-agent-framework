import type { HTMLAttributes } from 'react';

/**
 * Permalink affordance rendered alongside MDX headings.
 *
 * The visible `#` glyph is supplied by CSS (`.docs-prose .heading-anchor::before`
 * in global.css) rather than by a text node, so it never lands in the heading's
 * `textContent`. That keeps extracted heading text clean for search snippets,
 * page outlines, and any agent reading the DOM, while the anchor itself stays a
 * real, keyboard-reachable, accessibly-named link.
 *
 * It is rendered *after* `{children}` so the reading order is
 * "heading text, then permalink" even if the stylesheet never loads.
 */
function HeadingAnchor({ id }: { id: string }) {
  return <a href={`#${id}`} aria-label={`Link to ${id}`} className="heading-anchor" />;
}

/** MDX component overrides that add permalink anchors to H2/H3. */
export const mdxHeadingComponents = {
  h2: ({ id, children, ...rest }: HTMLAttributes<HTMLHeadingElement>) => (
    <h2 id={id} {...rest}>
      {children}
      {id ? <HeadingAnchor id={id} /> : null}
    </h2>
  ),
  h3: ({ id, children, ...rest }: HTMLAttributes<HTMLHeadingElement>) => (
    <h3 id={id} {...rest}>
      {children}
      {id ? <HeadingAnchor id={id} /> : null}
    </h3>
  ),
};
