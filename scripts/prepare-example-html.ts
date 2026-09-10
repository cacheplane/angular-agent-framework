/** Prepare Angular output for subpath hosting under script-src 'self'. */
export function prepareExampleHtml(
  html: string,
  product: string,
  topic: string
): string {
  return html
    .replace('<base href="/">', `<base href="/${product}/${topic}/">`)
    .replace(/<link\b[^>]*>/g, (tag) => {
      // Angular's critical-CSS optimization defers the full stylesheet with an
      // inline handler. Load it normally because the runtime CSP forbids handlers.
      if (
        !tag.includes('rel="stylesheet"') ||
        !tag.includes('onload="this.media=\'all\'"')
      )
        return tag;
      return tag
        .replace('media="print"', 'media="all"')
        .replace(' onload="this.media=\'all\'"', '');
    });
}
