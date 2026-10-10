import {createClient} from "@supabase/supabase-js";
import {createMcpHandler, withMcpAuth} from "mcp-handler";
import {INSTRUCTIONS, registerTools} from "../../lib/mcp/tools";

// The AI connector: an MCP server that people add to Claude, ChatGPT or another assistant as a
// custom connector, so their own AI can read and plan their Zeflo schedule. Signing in goes
// through Supabase's OAuth server (the consent screen is /oauth/consent); the assistant then sends
// the user's access token with every request.

const handler = createMcpHandler(registerTools, {
  serverInfo: {name: "Zeflo", version: "1.0.0"},
  instructions: INSTRUCTIONS,
});

// Accepts only access tokens Supabase issued to a connected app (they carry its client_id), checked
// for signature and expiry. Anything else gets a 401 that points the assistant at the sign-in.
async function verifyToken(_req: Request, token?: string) {
  if (!token) return undefined;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: {persistSession: false, autoRefreshToken: false},
  });
  const {data, error} = await supabase.auth.getClaims(token);
  const claims = data?.claims;
  if (error || !claims?.sub || typeof claims.client_id !== "string") return undefined;
  return {token, clientId: claims.client_id, scopes: [], expiresAt: claims.exp, extra: {userId: claims.sub}};
}

const authed = withMcpAuth(handler, verifyToken, {required: true});

export {authed as GET, authed as POST, authed as DELETE};
