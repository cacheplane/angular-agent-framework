const CACHE_CONTROL = 'public, max-age=86400';

export function GET(request: Request) {
  void request;
  return new Response(null, {
    status: 308,
    headers: {
      Location: '/icon.svg',
      'Cache-Control': CACHE_CONTROL,
    },
  });
}
