import { NextResponse } from 'next/server';

const CACHE_CONTROL = 'public, max-age=86400';

export function GET(request: Request) {
  const response = NextResponse.redirect(
    new URL('/icon.svg', request.url),
    308
  );
  response.headers.set('Cache-Control', CACHE_CONTROL);
  return response;
}
