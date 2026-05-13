import { NextResponse } from 'next/server';

const ONE_YEAR_S = 60 * 60 * 24 * 365;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new NextResponse('invalid json', { status: 400 });
  }
  const theme =
    body && typeof body === 'object' && 'theme' in body ? (body as { theme: unknown }).theme : null;
  if (theme !== 'light' && theme !== 'dark') {
    return new NextResponse('bad theme', { status: 400 });
  }
  const res = new NextResponse(null, { status: 204 });
  res.cookies.set('theme', theme, {
    path: '/',
    maxAge: ONE_YEAR_S,
    sameSite: 'lax',
    httpOnly: false,
  });
  return res;
}
