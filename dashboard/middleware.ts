import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const ADMIN_ONLY_PATHS = ["/forms", "/team", "/audit", "/settings"];
const ADMIN_ONLY_API = ["/api/forms", "/api/team", "/api/settings"];
const PUBLIC_PATHS = ["/login", "/auth"];

export async function middleware(request: NextRequest) {
  const { user, supabase, supabaseResponse } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // Allow public paths + Next internals
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return supabaseResponse;
  }

  // Not authenticated → redirect to login (or 401 for API calls)
  if (!user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Admin-only gate (pages + API)
  const isAdminPath = ADMIN_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const isAdminApi = ADMIN_ONLY_API.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (isAdminPath || isAdminApi) {
    const { data: dashUser } = await supabase
      .from("dashboard_users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!dashUser || dashUser.role !== "admin") {
      if (isAdminApi) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const url = request.nextUrl.clone();
      url.pathname = "/applications";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
