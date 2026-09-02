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
    why: 'Compact card diagrams must never inherit the 600px phone floor: inside a grid card that floor would force an internal scroll where none is affordable. Losing this override silently reintroduces it.',
    requires: {
      'min-width': /min-width:\s*0/,
    },
  },
];

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
});
