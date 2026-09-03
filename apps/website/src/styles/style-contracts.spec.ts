import { describe, expect, it } from 'vitest';
import { declarationsFor, loadStylesheet } from './style-contract';

/**
 * The registry of CSS declarations that are load-bearing and whose loss is
 * silent — the page still renders, just wrongly.
 *
 * Add an entry when you find yourself writing a comment in a stylesheet that
 * explains why a declaration must not be removed. That comment is the tell:
 * the next person cannot see the consequence from the code, and neither can
 * jsdom.
 *
 * Do not add ordinary styling here. A contract that fires on every design
 * tweak teaches people to delete contracts.
 */
interface StyleContract {
  file: string;
  selector: string;
  /** Why losing this is invisible. Read by whoever the failure wakes up. */
  why: string;
  requires: Record<string, RegExp>;
}

const CONTRACTS: StyleContract[] = [
  {
    file: 'docs.css',
    selector: '.docs-sidebar-lib-item-text',
    why: 'Title and tagline are sibling spans; this column is the only thing stacking them. Losing it renders every picker row as one run-on line — shipped to production in #892.',
    requires: {
      display: /display:\s*flex/,
      'flex-direction': /flex-direction:\s*column/,
    },
  },
  {
    file: 'docs.css',
    selector: '.docs-sidebar-lib-menu',
    why: 'The picker menu opens ~340px down a scrolling pane. Without a cap it runs past the fold and the last libraries are unreachable.',
    requires: {
      'max-height': /max-height:/,
      'overflow-y': /overflow-y:\s*auto/,
    },
  },
  {
    file: 'docs.css',
    selector: '.docs-control-plane',
    why: 'In a flex row an un-aligned sticky child stretches to the article\'s full height, so its own height cap never applies and internal scrolling silently stops working.',
    requires: {
      position: /position:\s*sticky/,
      'align-self': /align-self:\s*flex-start/,
    },
  },
  {
    file: 'docs.css',
    selector: '.docs-prose a:not([data-mdx-chrome])',
    why: 'Tailwind Typography is inert in this app — `.prose` emits zero rules, so `--tw-prose-links` on MdxRenderer set a variable nothing read and every docs link rendered as plain body text (measured: rgb(28,28,28), no decoration). This rule is the only thing making a docs link look like a link.',
    requires: {
      color: /color:\s*var\(--color-accent\)/,
      'text-decoration': /text-decoration:\s*underline/,
    },
  },
  {
    file: 'docs.css',
    selector: '[data-mdx="callout"] .mdx-callout-body a:not([data-mdx-chrome])',
    why: "A callout's body text is already muted, so an accent-blue link inside a warning callout reads as a rendering error. Losing this leaves callout links legible but wrongly toned — the failure nobody reports.",
    requires: {
      color: /color:\s*var\(--callout-tone-text\)/,
      'font-weight': /font-weight:\s*500/,
    },
  },
  {
    file: 'docs.css',
    selector: '.docs-prose a[href^="http"]:not([data-mdx-chrome])::after',
    why: 'The only signal that a docs link leaves the site. Losing it renders an off-site link identically to an in-site one, which is invisible until someone loses their place.',
    requires: {
      content: /content:/,
    },
  },
  {
    file: '../app/global.css',
    selector: 'pre.shiki',
    why: "Shiki writes the theme background inline on the <pre> but emits no padding, so losing this sits the code flush against the dark surface's edges — on the homepage Code tabs, /langgraph, /render, /chat and every /solutions page. Deleted once already in #863, on a docs-only survey that concluded `.shiki` matched nothing.",
    requires: {
      padding: /padding:/,
    },
  },
  {
    file: 'docs.css',
    selector: '.docs-control-plane [data-control-plane-pane]',
    why: 'The pane holds the whole docs nav in a fixed-height column. Without its own scrolling the lower sections are unreachable on short viewports.',
    requires: {
      'overflow-y': /overflow-y:\s*auto/,
    },
  },
  {
    file: 'docs.css',
    selector: '.website-workspace-host',
    why: 'The fixed site nav remains outside the workspace. This wrapper owns the remaining viewport and prevents the page footer from creating a second scroller.',
    requires: {
      height: /height:\s*100dvh/,
      'padding-top': /padding-top:\s*var\(--nav-h\)/,
      overflow: /overflow:\s*hidden/,
    },
  },
  {
    file: 'docs.css',
    selector: '.website-workspace-host .cockpit-shell',
    why: 'The shared shell uses h-screen by default; the Website host must subtract its fixed nav or the bottom of every workspace panel is clipped.',
    requires: {
      height: /height:\s*calc\(100dvh\s*-\s*var\(--nav-h\)\)/,
    },
  },
  {
    file: 'docs.css',
    selector: '#site-content:has([data-website-workspace-host])',
    why: 'Workspace routes own the viewport beneath the global nav and must not inherit ordinary page/footer scrolling.',
    requires: {
      height: /height:\s*100dvh/,
      overflow: /overflow:\s*hidden/,
    },
  },
  {
    file: 'docs.css',
    selector: '#site-content:has([data-website-workspace-host]) > .footer-root',
    why: 'The workspace is a full-height surface; the ordinary marketing footer must not add document height behind it.',
    requires: {
      display: /display:\s*none/,
    },
  },
  {
    file: 'docs.css',
    selector: 'html:has([data-website-workspace-host])',
    why: 'Workspace routes must lock the document scroll root so oversized control-plane descendants cannot create a second vertical scroller outside the article panel.',
    requires: {
      height: /height:\s*100%/,
      overflow: /overflow:\s*hidden/,
      'overscroll-behavior': /overscroll-behavior:\s*none/,
    },
  },
  {
    file: 'docs.css',
    selector: 'body:has([data-website-workspace-host])',
    why: 'The body must join the route-scoped root lock; locking only the shell still lets descendant min-content inflate document scrolling.',
    requires: {
      height: /height:\s*100%/,
      overflow: /overflow:\s*hidden/,
      'overscroll-behavior': /overscroll-behavior:\s*none/,
    },
  },
  {
    file: 'docs.css',
    selector: '.tp-diagram-figure',
    why: 'Diagram SVGs are wider than the article column on narrow viewports. Without horizontal scrolling the figure either overflows the page or gets silently clipped.',
    requires: {
      'overflow-x': /overflow-x:\s*auto/,
    },
  },
  {
    file: 'docs.css',
    selector: '.tp-diagram-svg',
    why: 'The docs-scale cap keeps diagrams from ballooning past a readable width in the article column; losing it lets the SVG stretch to the full (scrollable) figure width instead. The 600px floor keeps SVG text at >=94% of designed size on phones (shrinking the box shrinks the type with it) while still fitting the ~632px desktop column scroll-free.',
    requires: {
      'max-width': /max-width:\s*680px/,
      'min-width': /min-width:\s*600px/,
    },
  },
  {
    file: 'docs.css',
    selector: '.tp-diagram-figure[data-scale="compact"] .tp-diagram-svg',
    why: 'Compact card diagrams must never inherit the 600px phone floor: inside a grid card that floor would force an internal scroll where none is affordable. Losing the min-width override silently reintroduces that 600px floor. Losing the max-width cap lets a wide grid card scale the diagram past its tuned compact type ramp, ballooning the text.',
    requires: {
      'min-width': /min-width:\s*0/,
      'max-width': /max-width:\s*420px/,
    },
  },
];

function baseDeclarationsFor(css: string, selector: string): string {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let depth = 0;
  let ruleStart = 0;

  for (let index = 0; index < withoutComments.length; index += 1) {
    const character = withoutComments[index];
    if (character === '{') {
      if (depth === 0) {
        const ruleSelector = withoutComments.slice(ruleStart, index).trim();
        const close = withoutComments.indexOf('}', index + 1);
        if (ruleSelector === selector && close !== -1) {
          return withoutComments.slice(index + 1, close);
        }
      }
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
      if (depth === 0) ruleStart = index + 1;
    }
  }

  return '';
}

// Two rules with the same `@media` query are legitimate CSS — the second
// docs.css author to add a `(pointer: coarse)` block should not have to know
// about the first one. Returning only the first match here would silently
// hand a contract the wrong block's contents instead of erroring, exactly
// the failure mode declarationsFor() already avoids by merging every rule
// that matches a selector. So this merges every block for the query too.
function mediaBlock(css: string, query: string): string {
  const needle = `@media ${query}`;
  const blocks: string[] = [];
  let searchFrom = 0;

  for (;;) {
    const start = css.indexOf(needle, searchFrom);
    if (start === -1) break;
    const open = css.indexOf('{', start);
    let depth = 0;
    let end = -1;

    for (let index = open; index < css.length; index += 1) {
      if (css[index] === '{') depth += 1;
      if (css[index] === '}') {
        depth -= 1;
        if (depth === 0) {
          end = index;
          break;
        }
      }
    }

    if (end === -1) break;
    blocks.push(css.slice(open + 1, end));
    searchFrom = end + 1;
  }

  return blocks.join('\n');
}

describe('style contracts', () => {
  for (const contract of CONTRACTS) {
    describe(`${contract.file} ${contract.selector}`, () => {
      const declarations = declarationsFor(loadStylesheet(contract.file), contract.selector);

      it('has a rule at all', () => {
        // A selector that stops matching is the loudest way this drifts: the
        // rule was renamed or deleted and every property assertion below would
        // otherwise fail with the same unhelpful message.
        expect(declarations, contract.why).not.toBe('');
      });

      for (const [property, pattern] of Object.entries(contract.requires)) {
        it(`declares ${property}`, () => {
          expect(declarations, contract.why).toMatch(pattern);
        });
      }
    });
  }

  describe('docs.css page actions geometry and tooltip', () => {
    const css = loadStylesheet('docs.css');
    const trigger = baseDeclarationsFor(css, '.docs-page-actions-trigger');
    const tooltip = declarationsFor(css, '.docs-page-actions-tooltip');

    it('keeps the base trigger a borderless 44px rounded square outside media queries', () => {
      expect(trigger).toMatch(/width:\s*44px/);
      expect(trigger).toMatch(/height:\s*44px/);
      expect(trigger).toMatch(/border:\s*0/);
      expect(trigger).toMatch(/border-radius:\s*(?:8px|var\(--radius-[^)]+\))/);
    });

    it('transitions tooltip opacity and visibility over 120ms', () => {
      expect(tooltip).toMatch(/transition:[^;]*opacity\s+120ms[^;]*visibility\s+120ms/);
    });

    it('reveals the tooltip for trigger hover and keyboard focus', () => {
      for (const selector of [
        '.docs-page-actions-trigger:hover + .docs-page-actions-tooltip',
        '.docs-page-actions-trigger:focus-visible + .docs-page-actions-tooltip',
      ]) {
        const declarations = declarationsFor(css, selector);
        expect(declarations).toMatch(/opacity:\s*1/);
        expect(declarations).toMatch(/visibility:\s*visible/);
      }
    });

    it('keeps the tooltip interactive, hover-persistent, and bridged to the trigger', () => {
      expect(tooltip).toMatch(/pointer-events:\s*auto/);

      const hover = declarationsFor(css, '.docs-page-actions-tooltip:hover');
      expect(hover).toMatch(/opacity:\s*1/);
      expect(hover).toMatch(/visibility:\s*visible/);

      const bridge = declarationsFor(css, '.docs-page-actions-tooltip::before');
      expect(bridge).toMatch(/content:\s*['"]["']/);
      expect(bridge).toMatch(/position:\s*absolute/);
      expect(bridge).toMatch(/top:\s*-6px/);
      expect(bridge).toMatch(/left:\s*0/);
      expect(bridge).toMatch(/right:\s*0/);
      expect(bridge).toMatch(/height:\s*6px/);
    });

    it('suppresses the tooltip on coarse pointers', () => {
      expect(declarationsFor(mediaBlock(css, '(pointer: coarse)'), '.docs-page-actions-tooltip')).toMatch(/display:\s*none/);
    });

    it('removes tooltip transitions when reduced motion is requested', () => {
      expect(declarationsFor(mediaBlock(css, '(prefers-reduced-motion: reduce)'), '.docs-page-actions *')).toMatch(/transition:\s*none\s*!important/);
    });

    it('hides the shortcut hint on coarse pointers', () => {
      expect(
        declarationsFor(mediaBlock(css, '(pointer: coarse)'), '.docs-control-plane-search-kbd')
      ).toMatch(/display:\s*none/);
    });
  });
});
