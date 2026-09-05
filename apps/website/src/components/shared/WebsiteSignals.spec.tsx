import { render } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ path: '/', observe: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => mocks.path }));
vi.mock('../../lib/growth/website-collector', () => ({
  observeWebsitePath: mocks.observe,
}));
import { WebsiteSignals } from './WebsiteSignals';
it('observes pathname transitions with the server-provided catalog', () => {
  const catalog = {
    '/': { contentId: 'home', topic: 'getting_started' as const },
  };
  const view = render(<WebsiteSignals catalog={catalog} />);
  expect(mocks.observe).toHaveBeenLastCalledWith('/', catalog);
  mocks.path = '/docs';
  view.rerender(<WebsiteSignals catalog={catalog} />);
  expect(mocks.observe).toHaveBeenLastCalledWith('/docs', catalog);
});
