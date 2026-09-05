import { vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  handle: vi.fn(async () => new Response(null, { status: 204 })),
  defaults: { marker: 'dependencies' },
}));
vi.mock('../../../../../../lib/growth/collection-route', () => ({
  defaultCollectionRouteDependencies: () => mocks.defaults,
  createCollectionRoute: vi.fn(() => mocks.handle),
}));
import { POST, OPTIONS, runtime } from './route';
import { createCollectionRoute } from '../../../../../../lib/growth/collection-route';
it('wires POST and OPTIONS through the shared Node collection handler', async () => {
  expect(runtime).toBe('nodejs');
  expect(createCollectionRoute).toHaveBeenCalledWith(mocks.defaults);
  for (const [method, handler] of [
    ['POST', POST],
    ['OPTIONS', OPTIONS],
  ] as const) {
    const request = new Request('https://example.invalid', { method });
    expect(
      (
        await handler(request, {
          params: Promise.resolve({ source: 'runtime' }),
        })
      ).status
    ).toBe(204);
    expect(mocks.handle).toHaveBeenLastCalledWith(request, 'runtime');
  }
});
