import type { JsonLdNode } from '../../lib/structured-data';

/**
 * Renders schema.org JSON-LD.
 *
 * React does not escape the body of a `<script>`, so the payload is written with
 * `dangerouslySetInnerHTML` and every `<` character is replaced by the six-byte
 * escape sequence `\u003c`. That replacement is what makes this safe,
 * unconditionally: no value can emit a literal `<`, so no value can close the
 * script tag and start injecting markup — whatever the value is and wherever it
 * came from.
 *
 * This is not merely belt-and-braces over trusted input. Some of what flows
 * through here (blog headlines, descriptions) is MDX frontmatter: our own
 * content, but content rather than code.
 *
 * `\u003c` is a standard JSON string escape, so the escaped payload parses back to
 * exactly the original value — see the round-trip assertion in the spec.
 */
export function JsonLd({ data }: { data: JsonLdNode | JsonLdNode[] }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
