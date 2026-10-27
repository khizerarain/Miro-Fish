import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session-token";
import { env } from "@/lib/env";

const PROTECTED_PREFIXES = ["/dashboard", "/experiments", "/audiences", "/settings"];
const AUTH_PAGES = ["/login", "/signup"];

const matches = (path: string, prefixes: string[]) => prefixes.some((p) => path === p || path.startsWith(`${p}/`));

/** Returns whether the request is signed in, refreshing Supabase cookies onto `response` when needed. */
async function isSignedIn(request: NextRequest, response: NextResponse): Promise<boolean> {
  const e = env();
  if (e.AUTH_PROVIDER === "local") {
    return (await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value, e.AUTH_SECRET!)) !== null;
  }
  const supabase = createServerClient(e.NEXT_PUBLIC_SUPABASE_URL!, e.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value, options } of toSet) {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        }
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  return data.user !== null;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const response = NextResponse.next({ request });
  const signedIn = await isSignedIn(request, response);

  if (!signedIn && matches(pathname, PROTECTED_PREFIXES)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  if (signedIn && matches(pathname, AUTH_PAGES)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
