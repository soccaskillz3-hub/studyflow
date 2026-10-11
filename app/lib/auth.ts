"use server";

import type {AuthError} from "@supabase/supabase-js";
import {cookies, headers} from "next/headers";
import {redirect} from "next/navigation";
import {RESET_PENDING_COOKIE} from "./resetPending";
import {safeNext} from "./safeNext";
import {createClient} from "./supabase/server";

export type AuthState = {error?: string; sent?: string} | null;

const MIN_PASSWORD = 8;

const text = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
};


// Where email links (confirm the account, reset the password) should bring people back to.
async function siteUrl() {
  const h = await headers();
  return h.get("origin") ?? `https://${h.get("host")}`;
}

function describe(error: AuthError) {
  // The email provider turned the email down (e.g. Supabase's SMTP settings are wrong). Logged,
  // so it shows up in the hosting logs.
  if (/error sending/i.test(error.message)) {
    console.error("Auth email failed:", error.message);
    return "We couldn't send the email just now. Please try again in a few minutes.";
  }
  switch (error.code) {
    case "invalid_credentials":
      return "That email and password don't match an account.";
    case "email_not_confirmed":
      return "Confirm your email first: open the link we sent you.";
    case "user_already_exists":
    case "email_exists":
      return "There's already an account with that email. Try logging in.";
    case "weak_password":
      return "Pick a stronger password: longer, or with a mix of letters, numbers and symbols.";
    case "same_password":
      return "That's your current password. Pick a new one.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many attempts. Wait a few minutes and try again.";
    case "validation_failed":
      return "That email address doesn't look right.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const email = text(form, "email");
  const password = form.get("password");
  if (!email) return {error: "Enter your email."};
  if (typeof password !== "string" || password.length < MIN_PASSWORD) {
    return {error: `Use at least ${MIN_PASSWORD} characters for your password.`};
  }

  const supabase = await createClient();
  const {data, error} = await supabase.auth.signUp({
    email,
    password,
    options: {emailRedirectTo: `${await siteUrl()}/auth/confirm?next=/`},
  });
  if (error) return {error: describe(error)};
  // With email confirmation turned off, the account is ready and logged in straight away.
  if (data.session) redirect("/");
  return {sent: email};
}

export async function logIn(_: AuthState, form: FormData): Promise<AuthState> {
  const email = text(form, "email");
  const password = form.get("password");
  if (!email || typeof password !== "string" || !password) return {error: "Enter your email and password."};

  const supabase = await createClient();
  const {error} = await supabase.auth.signInWithPassword({email, password});
  if (error) return {error: describe(error)};
  (await cookies()).delete(RESET_PENDING_COOKIE); // a normal login ends any unfinished reset
  redirect(safeNext(text(form, "next")));
}

// Logs out of this browser only. (Supabase's default logs out everywhere, which would also
// sign out the person's other devices and disconnect any AI assistant they've connected.)
export async function logOut() {
  const supabase = await createClient();
  await supabase.auth.signOut({scope: "local"});
  (await cookies()).delete(RESET_PENDING_COOKIE);
  redirect("/");
}

// "I remembered it" on the reset page: undo the login the reset link did, and go log in properly.
export async function cancelPasswordReset() {
  const supabase = await createClient();
  await supabase.auth.signOut({scope: "local"});
  (await cookies()).delete(RESET_PENDING_COOKIE);
  redirect("/login");
}

export async function requestPasswordReset(_: AuthState, form: FormData): Promise<AuthState> {
  const email = text(form, "email");
  if (!email) return {error: "Enter your email."};

  const supabase = await createClient();
  const {error} = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteUrl()}/auth/confirm?next=/reset-password`,
  });
  // Same answer whether or not the email has an account, so this can't be used to look people up.
  if (error && error.code !== "user_not_found") return {error: describe(error)};
  return {sent: email};
}

// Settings → Delete account: removes the login and everything in it (see the delete_account
// migration), then shows the welcome page with a note that it's done. The form asks for
// "DELETE" to be typed first, so it can't happen by accident.
export async function deleteAccount(_: AuthState, form: FormData): Promise<AuthState> {
  if (text(form, "confirm") !== "DELETE") return {error: "Type DELETE to confirm."};

  const supabase = await createClient();
  const {error} = await supabase.rpc("delete_my_account");
  if (error) {
    console.error("Account deletion failed:", error.message);
    return {error: "Couldn't delete your account. Please try again, or contact us."};
  }
  // The login no longer exists, so just clear its cookies here.
  await supabase.auth.signOut({scope: "local"});
  (await cookies()).delete(RESET_PENDING_COOKIE);
  redirect("/?deleted=1");
}

export async function updatePassword(_: AuthState, form: FormData): Promise<AuthState> {
  const password = form.get("password");
  if (typeof password !== "string" || password.length < MIN_PASSWORD) {
    return {error: `Use at least ${MIN_PASSWORD} characters for your password.`};
  }

  const supabase = await createClient();
  const {error} = await supabase.auth.updateUser({password});
  if (error) return {error: describe(error)};
  (await cookies()).delete(RESET_PENDING_COOKIE);
  redirect("/");
}
