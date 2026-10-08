import "server-only";

import {createServerClient} from "@supabase/ssr";
import {cookies} from "next/headers";

// Supabase in Server Components, Server Actions and Route Handlers, using the login cookies
// from the current request. Create one per request; never share it between requests.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({name, value, options}) => cookieStore.set(name, value, options));
        } catch {
          // Server Components can't set cookies. That's fine: the proxy refreshes the login on
          // every request, so there's nothing left to write here.
        }
      },
    },
  });
}
