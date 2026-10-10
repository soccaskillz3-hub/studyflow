import type {Metadata} from "next";
import Consent from "./Consent";

export const metadata: Metadata = {title: "Connect your AI · Zeflo"};

// Where Supabase's OAuth server sends people when an AI assistant asks to connect to their
// Zeflo account (set as the Authorization Path in Supabase: Authentication → OAuth Server).
// The proxy has already made sure they're logged in, bringing them back here after logging in.
export default async function ConsentPage({searchParams}: PageProps<"/oauth/consent">) {
  const {authorization_id: id} = await searchParams;
  return <Consent authorizationId={typeof id === "string" ? id : null} />;
}
