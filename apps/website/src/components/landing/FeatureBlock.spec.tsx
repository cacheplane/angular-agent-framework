import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FeatureBlock } from './FeatureBlock';

const base = {
  eyebrow: 'Render',
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
    expect(container.querySelector('.feature-block-card-row')).toBeNull();
    expect(container.querySelector('.feature-block-bullets')).toBeNull();
    expect(container.querySelector('.feature-block-rail')).toBeTruthy();
  });

  it('bullets variant (the five non-home pages) still renders bullets and cards', () => {
    const { container } = render(
      <FeatureBlock
        {...base}
        bullets={['First bullet', 'Second bullet']}
        supportingCards={[{ title: 'chat-timeline', description: 'Drop-in surface.' }]}
      />,
    );
    expect(screen.getByText('First bullet')).toBeTruthy();
    expect(screen.getByText('chat-timeline')).toBeTruthy();
    expect(container.querySelector('.feature-block-rows')).toBeNull();
    expect(container.querySelector('.feature-block-rail')).toBeNull();
  });
});
