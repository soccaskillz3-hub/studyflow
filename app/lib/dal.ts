import "server-only";

import {redirect} from "next/navigation";
import {cache} from "react";
import {createClient} from "./supabase/server";

export type User = {id: string; email: string};

// The logged-in user, or null. Verified from the login token on the server, so it can be trusted
// for access decisions. Cached for the length of one request.
export const getUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {data} = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return {id: claims.sub, email: typeof claims.email === "string" ? claims.email : ""};
});

// For pages that need a login: the user, or a redirect to the login page.
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}
