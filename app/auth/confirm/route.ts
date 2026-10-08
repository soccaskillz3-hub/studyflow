import type {EmailOtpType} from "@supabase/supabase-js";
import {redirect} from "next/navigation";
import type {NextRequest} from "next/server";
import {createClient} from "../../lib/supabase/server";

// Where the links in StudyFlow's emails land (confirming a new account, resetting a password).
// A valid link logs the person in and sends them on to `next`.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = params.get("next") ?? "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const supabase = await createClient();

  // Links built from the token hash work on any device (see the README's Supabase setup).
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  if (tokenHash && type) {
    const {error} = await supabase.auth.verifyOtp({type, token_hash: tokenHash});
    if (!error) redirect(safeNext);
  }

  // Supabase's default email links send a one-time code instead, which only works in the
  // browser that asked for the email.
  const code = params.get("code");
  if (code) {
    const {error} = await supabase.auth.exchangeCodeForSession(code);
    if (!error) redirect(safeNext);
  }

  redirect("/login?error=link");
}
