import { describe, expect, it } from 'vitest';
import { prepareExampleHtml } from './prepare-example-html';

describe('assembled example HTML under script-src self', () => {
  it('activates Angular deferred CSS without executing an inline handler', () => {
    const html = `<base href="/"><link rel="stylesheet" href="styles.css" media="print" onload="this.media='all'"><noscript><link rel="stylesheet" href="styles.css"></noscript>`;
    const prepared = prepareExampleHtml(html, 'ag-ui', 'interrupts');
    expect(prepared).toContain('<base href="/ag-ui/interrupts/">');
    expect(prepared).toContain(
      '<link rel="stylesheet" href="styles.css" media="all">'
    );
    expect(prepared).not.toContain('onload=');
    expect(prepared).toContain(
      '<noscript><link rel="stylesheet" href="styles.css"></noscript>'
    );
    expect(prepareExampleHtml(prepared, 'ag-ui', 'interrupts')).toBe(prepared);
  });

  it('preserves genuine print styles and script assets', () => {
    const html =
      '<link rel="stylesheet" href="print.css" media="print"><script src="main.js" type="module"></script>';
    expect(prepareExampleHtml(html, 'chat', 'threads')).toBe(html);
  });
});
