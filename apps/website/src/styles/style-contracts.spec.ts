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
