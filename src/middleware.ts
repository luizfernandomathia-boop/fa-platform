/**
 * Next.js middleware — runs before every non-static request.
 *
 * Responsibilities:
 *  1. Refresh the Supabase session (keeps the JWT alive without page reload)
 *  2. Protect /upload, /resultados, /historico — redirect to /login if not authenticated
 *  3. Redirect authenticated users away from /login and /cadastro
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED = ["/upload", "/resultados", "/historico", "/projetos", "/dashboard"];
const AUTH_ONLY = ["/login", "/cadastro"];

export async function middleware(request: NextRequest) {
  // We build the response first so we can set cookies on it later
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // NextRequest.cookies is synchronous — safe in middleware
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write cookies on both the request (for downstream) and the response
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Always call getUser() — this is what refreshes the session cookie
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  const isAuthPage  = AUTH_ONLY.includes(pathname);

  // Unauthenticated → redirect to login, preserving intended destination
  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Already authenticated → skip login/signup, go to projects home
  if (isAuthPage && user) {
    return NextResponse.redirect(new URL("/projetos", request.url));
  }

  return response;
}

export const config = {
  // Run on all routes except static assets, images, and API routes
  // (API routes handle their own auth checks)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
