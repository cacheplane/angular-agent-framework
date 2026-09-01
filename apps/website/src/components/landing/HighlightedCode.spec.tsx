// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { HighlightedCode } from './HighlightedCode';

/**
 * The markup half of the padding contract that regressed in #863.
 *
 * The CSS half — that `pre.shiki` actually declares a padding — is a style
 * contract in styles/style-contracts.spec.ts. Both halves are needed and
 * neither is sufficient: the contract survives this component switching
 * highlighters (guarding a rule nothing emits any more), and these assertions
 * survive the rule being deleted again as dead.
 *
 * What makes the pairing load-bearing is that Shiki puts the theme background
 * INLINE on the <pre> while emitting no padding of its own. So the padding has
 * to land on that same element — the wrapper <div> carries `shiki` too, and
 * padding there sits outside the dark surface as a light gutter.
 */
async function renderToHtml() {
  // An async Server Component: await the element and read the markup it hands
  // to `dangerouslySetInnerHTML`, no DOM needed.
  const element = await HighlightedCode({ code: 'const answer = 42;' });
  return element.props.dangerouslySetInnerHTML.__html as string;
}

describe('HighlightedCode', () => {
  it('emits a <pre class="shiki"> for the pre.shiki contract to match', async () => {
    expect(await renderToHtml()).toMatch(/<pre class="shiki[^"]*"/);
  });

  it('carries the theme background inline on that <pre>', async () => {
    // This is why padding must go on the <pre> and not on the wrapper.
    expect(await renderToHtml()).toMatch(
      /<pre class="shiki[^"]*"[^>]*style="[^"]*background-color:/,
    );
  });

  it('emits no padding of its own, leaving CSS as the only source', async () => {
    expect(await renderToHtml()).not.toMatch(/<pre[^>]*style="[^"]*padding/);
  });

  it('puts `shiki` on the wrapper too, so the rule must stay pre-scoped', async () => {
    const element = await HighlightedCode({ code: 'const answer = 42;' });
    expect(element.props.className).toBe('shiki');
  });
});
