import {createServerClient} from "@supabase/ssr";
import {NextResponse, type NextRequest} from "next/server";

// Refreshes the visitor's login (if any) on every request and reports who they are.
// Returns the response that carries the refreshed cookies: send it, or pass any other response
// through `carry` so the cookies and no-cache headers go with it.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({request});
  let headers: Record<string, string> = {};

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, cacheHeaders) {
          // Pages rendered for this request read the refreshed cookies; the browser stores them.
          cookiesToSet.forEach(({name, value}) => request.cookies.set(name, value));
          response = NextResponse.next({request});
          cookiesToSet.forEach(({name, value, options}) => response.cookies.set(name, value, options));
          // Responses that set login cookies must never be cached and served to someone else.
          headers = {...headers, ...cacheHeaders};
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // Verifies the login token (it can't be forged) and refreshes it when it's about to expire.
  // Nothing may run between creating the client and this call.
  const {data} = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  const carry = (other: NextResponse) => {
    response.cookies.getAll().forEach((cookie) => other.cookies.set(cookie));
    Object.entries(headers).forEach(([key, value]) => other.headers.set(key, value));
    return other;
  };

  return {response, signedIn, carry};
}
