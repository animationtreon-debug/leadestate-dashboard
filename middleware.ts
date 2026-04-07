import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth"];

// In-memory rate limiter for /api/auth (brute-force protection)
// Tracks attempts per IP: { ip -> { count, resetAt } }
const authAttempts = new Map<string, { count: number; resetAt: number }>();
const AUTH_WINDOW_MS = 60_000; // 1 minute
const AUTH_MAX_ATTEMPTS = 10;  // 10 attempts per minute per IP

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = authAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    authAttempts.set(ip, { count: 1, resetAt: now + AUTH_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > AUTH_MAX_ATTEMPTS;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Rate-limit login attempts before anything else
  if (pathname.startsWith("/api/auth") && req.method === "POST") {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many attempts. Try again in a minute." },
        { status: 429 }
      );
    }
  }

  // Allow public paths through
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check auth cookie
  const auth = req.cookies.get("dashboard_auth")?.value;
  if (auth === "1") {
    return NextResponse.next();
  }

  // API routes: return 401 JSON (not a redirect — redirects can be bypassed)
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Pages: redirect to login, preserving the intended destination
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
