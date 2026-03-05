/**
 * navV2 query strip: 브라우저 네비게이션에 한해 /app/* 에서 navV2 제거 → canonical URL
 * _rsc 요청에는 redirect 적용 안 함 (루프 방지)
 */
import { NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: '/app/:path*',
};

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const hasNavV2 = url.searchParams.has('navV2');
  const hasRsc = url.searchParams.has('_rsc');

  if (!hasNavV2 || hasRsc) {
    return NextResponse.next();
  }

  url.searchParams.delete('navV2');
  const target = url.pathname + (url.searchParams.toString() ? '?' + url.searchParams.toString() : '');
  return NextResponse.redirect(new URL(target, req.url), 308);
}
