import {metadataCorsOptionsRequestHandler, protectedResourceHandler} from "mcp-handler";

// Tells AI assistants where to sign people in for the connector at /api/mcp: Supabase's OAuth
// server for this project (RFC 9728 protected resource metadata).
const handler = protectedResourceHandler({authServerUrls: [`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1`]});

const preflight = metadataCorsOptionsRequestHandler();

export {handler as GET, preflight as OPTIONS};
