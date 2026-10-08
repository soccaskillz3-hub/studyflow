import {createBrowserClient} from "@supabase/ssr";

// Supabase from the browser. Signed-in requests carry the user's login, and the database's
// row level security limits every query to that user's own rows.
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
}
