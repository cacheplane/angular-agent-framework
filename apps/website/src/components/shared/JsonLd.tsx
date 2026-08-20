// SPDX-License-Identifier: MIT
import type { JsonLdNode } from '../../lib/structured-data';

/**
 * Renders schema.org JSON-LD. Content is generated from our own data, never
 * from user input, so `dangerouslySetInnerHTML` is safe here; `<` is still
 * escaped so a stray value cannot close the script tag. `<` is a valid
 * JSON string escape, so the escaped payload still parses back identically.
 */
export function JsonLd({ data }: { data: JsonLdNode | JsonLdNode[] }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
