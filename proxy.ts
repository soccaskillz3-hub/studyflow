import {NextResponse, type NextRequest} from "next/server";
import {RESET_PENDING_COOKIE} from "./app/lib/resetPending";
import {updateSession} from "./app/lib/supabase/proxy";

// Pages for people who aren't logged in. Logged-in visitors are sent on to the app instead.
const GUEST_PAGES = ["/welcome", "/login", "/signup", "/forgot-password"];
// Open to everyone: email links land here whether or not the visitor is logged in.
const OPEN_PAGES = ["/auth/confirm"];
// For AI assistants, not browsers: the connector checks its own OAuth token, and the metadata
// tells assistants where to sign in. No login cookies involved, so they skip all of the below.
const MACHINE_PATHS = ["/api/mcp", "/.well-known"];

const matches = (path: string, pages: string[]) => pages.some((p) => path === p || path.startsWith(`${p}/`));

// Keeps everyone's login fresh, and routes visitors: logged out, they see the welcome page at
// "/" and are asked to log in anywhere else in the app; logged in, they skip the welcome and
// login pages. This is only a quick first check: every page and query also checks the login
// (see app/lib/dal.ts and the database's row level security).
export async function proxy(request: NextRequest) {
  const {pathname, search} = request.nextUrl;
  if (matches(pathname, MACHINE_PATHS)) return NextResponse.next();

  const {response, signedIn, carry} = await updateSession(request);

  if (matches(pathname, OPEN_PAGES)) return response;

  if (signedIn) {
    // Logged in by a password reset link: finish the reset (or cancel it) first.
    if (request.cookies.has(RESET_PENDING_COOKIE) && pathname !== "/reset-password") {
      return carry(NextResponse.redirect(new URL("/reset-password", request.url)));
    }
    return matches(pathname, GUEST_PAGES) ? carry(NextResponse.redirect(new URL("/", request.url))) : response;
  }

  if (matches(pathname, GUEST_PAGES)) return response;
  // The address stays "/", so the site's front door is the welcome page.
  if (pathname === "/") return carry(NextResponse.rewrite(new URL("/welcome", request.url)));

  const login = new URL("/login", request.url);
  login.searchParams.set("next", pathname + search);
  return carry(NextResponse.redirect(login));
}

export const config = {
  // Everything except Next.js build files and images.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
