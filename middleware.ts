import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/admin-session";
import { GROWTH_COOKIE, canViewGrowth, isGrowthPath } from "@/lib/growth-access";
import { TAB_PATHS, normalizeTab } from "@/lib/app-tab-paths";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // #URL-PATHS-0810: /app?tab=… è legacy — ogni tab ha ora il suo path inglese.
  // Redirect permanente che DEVE restare: i link vecchi vivono in email CRM già
  // inviate e in bookmark. Gli altri query param passano intatti (?sport=,
  // ?activated=, ?ref=, ?crm=… vengono consumati dai loro effect al mount).
  if (pathname === "/app") {
    const url = req.nextUrl.clone();
    url.pathname = TAB_PATHS[normalizeTab(url.searchParams.get("tab")) ?? "bets"];
    url.searchParams.delete("tab");
    return NextResponse.redirect(url, 308);
  }

  // Protect admin UI pages (not the login page itself). The cookie carries an
  // expiring HMAC session token, never the raw ADMIN_SECRET (Edge-safe verify).
  // /admin/growth also accepts the separate view-only growth session.
  if (isGrowthPath(pathname)) {
    const ok = await canViewGrowth(
      req.cookies.get("admin_token")?.value,
      req.cookies.get(GROWTH_COOKIE)?.value
    );
    if (!ok) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }
  } else if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
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
  matcher: ["/admin/:path*", "/app"],
};
