/**
 * Paste into the browser console on a page BEFORE and AFTER a migration
 * batch (on main's dev server, then the branch's), then diff the two JSONs.
 * Serialises computed styles for every element carrying a migration hook.
 */
(() => {
  const PROPS = ['color','background-color','border-color','border-radius',
    'font-size','font-family','font-weight','line-height','letter-spacing',
    'padding','margin','gap','height','width','max-width','box-shadow',
    'display','align-items','justify-content','text-transform','opacity'];
  const hooks = document.querySelectorAll(
    '[data-ui],[data-mdx],[data-docs-navlink],[class]');
  const out = {};
  hooks.forEach((el, i) => {
    const key = `${el.tagName}#${el.id || i}.${el.getAttribute('data-ui')
      || el.getAttribute('data-mdx') || String(el.className).slice(0, 40)}`;
    const cs = getComputedStyle(el);
    out[key] = Object.fromEntries(PROPS.map((p) => [p, cs.getPropertyValue(p)]));
  });
  copy(JSON.stringify(out, null, 1));
  return `snapshot of ${hooks.length} elements copied to clipboard`;
})();
