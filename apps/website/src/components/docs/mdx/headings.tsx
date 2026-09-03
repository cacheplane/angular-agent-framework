import { isValidElement, type HTMLAttributes, type ReactNode } from 'react';

/**
 * Flatten a heading's children to plain text so the permalink can announce the
 * heading itself ("Link to At a glance") rather than its slug
 * ("Link to at-a-glance"). Children are frequently an array of nodes — MDX
 * wraps inline code, emphasis, and links in elements — so this walks them.
 */
function headingText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(headingText).join('');
  if (isValidElement(node)) return headingText((node.props as { children?: ReactNode }).children);
  return '';
}

/**
 * Permalink affordance rendered alongside MDX headings.
 *
 * The visible `#` glyph is supplied by CSS — the
 * `.docs-prose h2 .heading-anchor::before, .docs-prose h3 .heading-anchor::before`
 * rules in global.css — rather than by a text node, so it never lands in the
 * heading's `textContent`. That keeps extracted heading text clean for search
 * snippets, page outlines, and any agent reading the DOM, while the anchor
 * itself stays a real, keyboard-reachable, accessibly-named link.
 *
 * Note the CSS is scoped to H2/H3 *inside `.docs-prose`*: rendered under any
 * other wrapper, or at another heading level, this is an empty unstyled link
 * with no visible affordance. Keep the selectors and this component in step.
 *
 * The anchor is rendered *after* `{children}` so the reading order is
 * "heading text, then permalink" even if the stylesheet never loads.
 */
function HeadingAnchor({ id, children }: { id: string; children: ReactNode }) {
  const label = headingText(children).replace(/\s+/g, ' ').trim() || id;
  return <a href={`#${id}`} aria-label={`Link to ${label}`} className="heading-anchor" data-mdx-chrome="" />;
}

/** MDX component overrides that add permalink anchors to H2/H3. */
export const mdxHeadingComponents = {
  h2: ({ id, children, ...rest }: HTMLAttributes<HTMLHeadingElement>) => (
    <h2 id={id} {...rest}>
      {children}
      {id ? <HeadingAnchor id={id}>{children}</HeadingAnchor> : null}
    </h2>
  ),
  h3: ({ id, children, ...rest }: HTMLAttributes<HTMLHeadingElement>) => (
    <h3 id={id} {...rest}>
      {children}
      {id ? <HeadingAnchor id={id}>{children}</HeadingAnchor> : null}
    </h3>
  ),
};
