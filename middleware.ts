import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function isFrameworkPath(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico" ||
    /\.(?:css|js|map|png|jpg|jpeg|gif|svg|webp|ico|txt|xml)$/.test(pathname)
  );
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isFrameworkPath(pathname)) {
    return NextResponse.next();
  }

  const portalMode = process.env.MV_PORTAL_MODE;

  if (portalMode === "vinavi") {
    if (!pathname.startsWith("/vinavi")) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/vinavi";
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }
    return NextResponse.next();
  }

  if (portalMode === "surveillance" && pathname.startsWith("/vinavi")) {
    const vinaviOrigin = process.env.NEXT_PUBLIC_VINAVI_URL?.replace(/\/vinavi$/, "") ?? "http://localhost:3001";
    const redirectUrl = new URL(`${pathname}${search}`, vinaviOrigin);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};