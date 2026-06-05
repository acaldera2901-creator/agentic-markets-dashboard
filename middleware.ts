import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/admin-session";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Protect admin UI pages (not the login page itself). The cookie carries an
  // expiring HMAC session token, never the raw ADMIN_SECRET (Edge-safe verify).
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    const token = req.cookies.get("admin_token")?.value;
    const secret = process.env.ADMIN_SECRET;

    if (!secret || !(await verifyAdminToken(token, secret))) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
