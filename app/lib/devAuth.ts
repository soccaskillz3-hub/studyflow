"use server";

import "server-only";

import {createClient as createAdminClient} from "@supabase/supabase-js";
import {headers} from "next/headers";
import {redirect} from "next/navigation";
import {randomBytes} from "node:crypto";
import {createClient} from "./supabase/server";

// One-click login for local development (`npm run dev` only). Signs in to a test account,
// creating it on first use, already confirmed so no email is sent. Each login sets a fresh
// random password, so there's no password stored anywhere. Two accounts (A and B) make it easy
// to check that one can't see the other's data.

const DEV_ACCOUNTS = {a: "dev-a@example.com", b: "dev-b@example.com"} as const;

export type DevLoginState = {error: string} | null;

const isLocalHost = (host: string) => /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);

export async function devLogIn(_: DevLoginState, form: FormData): Promise<DevLoginState> {
  if (process.env.NODE_ENV !== "development") return {error: "Dev login only works in development."};
  if (!isLocalHost((await headers()).get("host") ?? "")) return {error: "Dev login only works on localhost."};

  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) return {error: "Add SUPABASE_SECRET_KEY to .env.local, then restart the dev server."};

  const email = DEV_ACCOUNTS[form.get("account") === "b" ? "b" : "a"];
  const password = randomBytes(24).toString("base64url");

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secretKey, {
    auth: {autoRefreshToken: false, persistSession: false},
  });

  const {data: list, error: listError} = await admin.auth.admin.listUsers({page: 1, perPage: 1000});
  if (listError) return {error: `Couldn't reach Supabase as admin: ${listError.message}`};
  const existing = list.users.find((u) => u.email === email);

  const {error: saveError} = existing
    ? await admin.auth.admin.updateUserById(existing.id, {password})
    : await admin.auth.admin.createUser({email, password, email_confirm: true});
  if (saveError) return {error: `Couldn't set up ${email}: ${saveError.message}`};

  const supabase = await createClient();
  const {error} = await supabase.auth.signInWithPassword({email, password});
  if (error) return {error: `Couldn't log in as ${email}: ${error.message}`};
  redirect("/");
}
