import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const session = await auth();
  const isLoggedIn = !!session;
  
  const path = request.nextUrl.pathname;
  const isOnDashboard = path.startsWith("/dashboard");
  const isOnApiRoute = path.startsWith("/api");
  const isAuthRoute = path.startsWith("/api/auth");
  const isHealthRoute = path === "/api/health";

  // Allow auth and health routes
  if (isAuthRoute || isHealthRoute) {
    return NextResponse.next();
  }

  // Protect dashboard routes
  if (isOnDashboard && !isLoggedIn) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Protect API routes (except auth and health)
  if (isOnApiRoute && !isLoggedIn) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*"],
};

