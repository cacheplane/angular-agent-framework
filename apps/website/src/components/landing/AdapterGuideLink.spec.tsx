// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const trackCtaClickMock = vi.hoisted(() => vi.fn());
vi.mock('../../lib/analytics/client', () => ({ trackCtaClick: trackCtaClickMock, track: vi.fn() }));

beforeEach(() => trackCtaClickMock.mockClear());

describe('AdapterGuideLink', () => {
  it('links to the adapter guide and fires home_adapter_guide on click', async () => {
    const { AdapterGuideLink } = await import('./AdapterGuideLink');
    render(<AdapterGuideLink />);
    const link = screen.getByRole('link', { name: 'Choose an adapter →' });
    expect(link.getAttribute('href')).toBe('/docs/choosing-an-adapter');
    fireEvent.click(link);
    expect(trackCtaClickMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cta_id: 'home_adapter_guide',
        track: 'developer',
        surface: 'home',
        destination_url: '/docs/choosing-an-adapter',
      }),
    );
  });
});
