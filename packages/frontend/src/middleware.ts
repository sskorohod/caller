import { NextRequest, NextResponse } from 'next/server';

/**
 * Server-side guard for /admin routes.
 * Reads caller_token from cookie, verifies role=owner via backend API.
 * Non-owners are redirected to /dashboard.
 */
export async function middleware(request: NextRequest) {
  const token = request.cookies.get('caller_token')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login?returnUrl=/admin', request.url));
  }

  // In Docker: frontend calls backend internally via INTERNAL_API_URL
  // Fallback to public API URL for local dev
  const apiBase = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3011';
  // Ensure we have an absolute URL (NEXT_PUBLIC_API_URL might be "/api")
  const baseUrl = apiBase.startsWith('/') ? `http://localhost:3000${apiBase}` : apiBase;

  try {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${decodeURIComponent(token)}` },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return NextResponse.redirect(new URL('/login?returnUrl=/admin', request.url));
    }

    const data = await res.json();
    if (data.role !== 'owner') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return NextResponse.next();
  } catch {
    // Backend unreachable — deny access
    return NextResponse.redirect(new URL('/login?returnUrl=/admin', request.url));
  }
}

export const config = {
  matcher: '/admin/:path*',
};
