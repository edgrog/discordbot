import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const ADMIN_ONLY_PATHS = ["/forms", "/team", "/audit", "/settings"];
const ADMIN_ONLY_API = ["/api/forms", "/api/team", "/api/settings"];

export async function middleware(request: NextRequest) {
  // TODO: TEMPORARY — auth bypassed for testing. Re-enable before production.
  const { supabaseResponse } = await updateSession(request);
  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
