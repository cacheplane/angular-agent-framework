import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Reading declarations out of a stylesheet, for rules whose loss is *silent*.
 *
 * jsdom does not apply stylesheets, so a component test renders the same DOM
 * whether or not a load-bearing declaration exists. That gap is how PR #892
 * shipped a docs picker whose title and description collided into one run-on
 * line: the JSX moved off Tailwind onto semantic class names, the
 * `flex flex-col` was never ported, and every test stayed green.
 *
 * Use this only for declarations where the failure mode is plausible-but-wrong
 * rendering. Ordinary styling belongs in review, not in a test.
 *
 * Limitation: this is a flat scan, not a CSS parser. Rules nested in
 * `@media` blocks are merged into the same selector's declarations, and
 * cascade order is not modelled. That is fine for asserting "this declaration
 * exists somewhere for this selector" and wrong for anything subtler.
 */
export function loadStylesheet(file: string): string {
  return readFileSync(join(__dirname, file), 'utf8');
}

/** Merged declaration text for every rule whose selector list contains `selector`. */
export function declarationsFor(css: string, selector: string): string {
  // Comments must go first: a `/* ... */` above a rule lands inside the
  // selector capture below, and the exact match then never fires. That reads
  // as "the rule is missing" — which is how a contract would report a false
  // failure the moment someone documented the rule it guards.
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');

  return [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((match) => match[1].split(',').some((part) => part.trim() === selector))
    .map((match) => match[2])
    .join(';');
}
