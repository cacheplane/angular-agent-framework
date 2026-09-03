// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { JsonLd } from './JsonLd';

function renderScript(data: Parameters<typeof JsonLd>[0]['data']): HTMLScriptElement {
  const { container } = render(<JsonLd data={data} />);
  const script = container.querySelector('script[type="application/ld+json"]');
  expect(script).not.toBeNull();
  return script as HTMLScriptElement;
}

describe('JsonLd', () => {
  it('emits a parseable ld+json script', () => {
    const script = renderScript({ '@type': 'Organization', name: 'Threadplane' });
    expect(JSON.parse(script.textContent ?? '')).toEqual({
      '@type': 'Organization',
      name: 'Threadplane',
    });
  });

  it('accepts an array of nodes', () => {
    const script = renderScript([{ '@type': 'WebSite' }, { '@type': 'Organization' }]);
    expect(JSON.parse(script.textContent ?? '')).toHaveLength(2);
  });

  it('escapes < so a value cannot close the script tag', () => {
    const hostile = '</script><img src=x onerror=alert(1)>';
    const script = renderScript({ '@type': 'Organization', name: hostile });

    // The raw markup must contain no literal `<` inside the script body...
    expect(script.innerHTML).not.toContain('<');
    expect(script.innerHTML).toContain('\\u003c/script>');
    // ...and the escape is lossless: the value round-trips exactly.
    expect(JSON.parse(script.textContent ?? '')['name']).toBe(hostile);
  });

  it('does not inject a sibling element when a value looks like markup', () => {
    const { container } = render(
      <JsonLd data={{ name: '</script><b id="pwned">x</b>' }} />,
    );
    expect(container.querySelector('#pwned')).toBeNull();
    expect(container.childElementCount).toBe(1);
  });
});
