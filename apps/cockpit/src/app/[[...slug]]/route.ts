import { NextRequest, NextResponse } from 'next/server';
import {
  getLegacyWebsiteRedirect,
  getRootWebsiteRedirect,
} from '../../lib/cockpit-page';

export function GET(request: NextRequest): NextResponse {
  const pathname = request.nextUrl.pathname;
  const destination =
    pathname === '/'
      ? getRootWebsiteRedirect()
      : getLegacyWebsiteRedirect(
          pathname,
          request.nextUrl.searchParams.getAll('mode')
        );

  return destination
    ? NextResponse.redirect(destination, 308)
    : new NextResponse(null, { status: 404 });
}
