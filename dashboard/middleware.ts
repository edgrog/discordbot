import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const ADMIN_ONLY_PATHS = ["/forms", "/team", "/audit", "/settings"];
const ADMIN_ONLY_API = ["/api/forms", "/api/team", "/api/settings"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth check for login, auth callback, and static files
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    const { supabaseResponse } = await updateSession(request);
    return supabaseResponse;
  }

  const { user, supabaseResponse, supabase } = await updateSession(request);

  // No session → redirect to login
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Check dashboard_users table
  const { data: dashUser } = await supabase
    .from("dashboard_users")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (!dashUser) {
    // User authenticated but not in dashboard_users → sign out + redirect
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "access_denied");
    return NextResponse.redirect(url);
  }

  // Admin-only page check
  const isAdminRoute =
    ADMIN_ONLY_PATHS.some((p) => pathname.startsWith(p)) ||
    ADMIN_ONLY_API.some((p) => pathname.startsWith(p));

  if (isAdminRoute && dashUser.role !== "admin") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("toast", "unauthorized");
    return NextResponse.redirect(url);
  }

  // Update last_login (fire-and-forget, don't block the request)
  supabase
    .from("dashboard_users")
    .update({ last_login: new Date().toISOString() })
    .eq("id", user.id)
    .then();

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
