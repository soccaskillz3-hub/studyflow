"use server";

import type {AuthError} from "@supabase/supabase-js";
import {cookies, headers} from "next/headers";
import {redirect} from "next/navigation";
import {RESET_PENDING_COOKIE} from "./resetPending";
import {createClient} from "./supabase/server";

export type AuthState = {error?: string; sent?: string} | null;

const MIN_PASSWORD = 8;

const text = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
};

// Only follow redirects within the site ("/calendar", not "//evil.example" or a full URL).
const safeNext = (next: string) => (next.startsWith("/") && !next.startsWith("//") ? next : "/");

// Where email links (confirm the account, reset the password) should bring people back to.
async function siteUrl() {
  const h = await headers();
  return h.get("origin") ?? `https://${h.get("host")}`;
}

function describe(error: AuthError) {
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

export async function logOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  (await cookies()).delete(RESET_PENDING_COOKIE);
  redirect("/");
}

// "I remembered it" on the reset page: undo the login the reset link did, and go log in properly.
export async function cancelPasswordReset() {
  const supabase = await createClient();
  await supabase.auth.signOut();
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
