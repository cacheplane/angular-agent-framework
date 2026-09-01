import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FeatureBlock } from './FeatureBlock';

const base = {
  eyebrow: 'json-render',
  headline: 'Agent output, rendered as your components.',
  body: 'Two sentences.',
  cta: { label: 'See it', href: '/render' },
  visual: <div data-testid="visual" />,
};

describe('FeatureBlock', () => {
  it('rows variant renders claims with API tails and no cards', () => {
    const { container } = render(
      <FeatureBlock
        {...base}
        rows={[
          { claim: 'Your design system, not a chat widget', api: '@threadplane/render' },
          { claim: 'Unknown specs degrade per component', api: 'fallback + readiness gate' },
        ]}
      />,
    );
    expect(screen.getByText('Your design system, not a chat widget')).toBeTruthy();
    expect(screen.getByText('@threadplane/render')).toBeTruthy();
    expect(container.querySelectorAll('.feature-block-row')).toHaveLength(2);
    expect(container.querySelector('.feature-block-rail')).toBeTruthy();
  });
});
