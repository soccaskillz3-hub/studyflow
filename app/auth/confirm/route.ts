import type {EmailOtpType} from "@supabase/supabase-js";
import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import type {NextRequest} from "next/server";
import {RESET_PENDING_COOKIE} from "../../lib/resetPending";
import {safeNext} from "../../lib/safeNext";
import {createClient} from "../../lib/supabase/server";

// Where the links in StudyFlow's emails land (confirming a new account, resetting a password).
// A valid link logs the person in and sends them on to `next`.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNext(params.get("next"));
  const supabase = await createClient();

  // A password reset link logs the person in so they can choose a new password. Until they do
  // (or cancel), the proxy keeps them on the reset page rather than letting them into the app.
  const loggedIn = async () => {
    if (next === "/reset-password") {
      (await cookies()).set(RESET_PENDING_COOKIE, "1", {httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60});
    }
    redirect(next);
  };

  // Links built from the token hash work on any device (see the README's Supabase setup).
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  if (tokenHash && type) {
    const {error} = await supabase.auth.verifyOtp({type, token_hash: tokenHash});
    if (!error) await loggedIn();
  }

  // Supabase's default email links send a one-time code instead, which only works in the
  // browser that asked for the email.
  const code = params.get("code");
  if (code) {
    const {error} = await supabase.auth.exchangeCodeForSession(code);
    if (!error) await loggedIn();
  }

  redirect("/login?error=link");
}
