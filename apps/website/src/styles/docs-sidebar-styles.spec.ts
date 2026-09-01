import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The picker's title and tagline are two sibling spans. They only stack because
 * `.docs-sidebar-lib-item-text` is a column flex container — there is no other
 * rule keeping them apart.
 *
 * PR #892 moved the JSX off Tailwind onto semantic class names and dropped the
 * `flex flex-col` utilities without porting them here. Both spans fell back to
 * `display: inline`, every menu row rendered as one run-on line
 * ("LangGraphLangChain/LangGraph adapter for Angular UI"), and it shipped to
 * production unnoticed.
 *
 * jsdom does not apply this stylesheet, so the component tests cannot see it.
 * This is the only guard for that failure mode.
 */
const css = readFileSync(join(__dirname, 'docs.css'), 'utf8');

function ruleFor(selector: string): string {
  const blocks = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => m[1].split(',').some((s) => s.trim() === selector))
    .map((m) => m[2]);
  return blocks.join(';');
}

describe('docs sidebar library picker styles', () => {
  it('stacks the menu item title above its tagline', () => {
    const rule = ruleFor('.docs-sidebar-lib-item-text');

    expect(rule).toMatch(/display:\s*flex/);
    expect(rule).toMatch(/flex-direction:\s*column/);
  });

  it('caps the menu height so it cannot run past the fold', () => {
    const rule = ruleFor('.docs-sidebar-lib-menu');

    expect(rule).toMatch(/max-height:/);
    expect(rule).toMatch(/overflow-y:\s*auto/);
  });
});
