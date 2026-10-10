"use client";

import Link from "next/link";
import {useEffect, useState} from "react";
import type {OAuthAuthorizationDetails} from "@supabase/supabase-js";
import {authLink} from "../../../components/AuthForm";
import {createClient} from "../../../lib/supabase/client";

// What a connected assistant can do, in the words of the tools it gets (app/lib/mcp/tools.ts).
const CAN = [
  "See your classes, tests and exams",
  "See your study sessions and progress",
  "Plan, move, rename and tick off study sessions",
  "Remove study sessions (it should ask you first)",
];
// Enforced by the database for connected apps (supabase/migrations/20261010120000_ai_connector.sql).
const CANNOT = ["See your password", "Change your classes or settings"];

const button = "flex-1 px-5 py-3 text-xs font-semibold uppercase tracking-[0.25em] transition active:scale-[0.99] disabled:cursor-wait disabled:opacity-60";

type State =
  | {step: "loading"}
  | {step: "ask"; details: OAuthAuthorizationDetails}
  | {step: "leaving"}
  | {step: "error"; message: string};

export default function Consent({authorizationId}: {authorizationId: string | null}) {
  const [state, setState] = useState<State>(
    authorizationId ? {step: "loading"} : {step: "error", message: "This link is missing its request. Start connecting again from your AI app."},
  );

  useEffect(() => {
    if (!authorizationId) return;
    createClient()
      .auth.oauth.getAuthorizationDetails(authorizationId)
      .then(({data, error}) => {
        if (error || !data) return setState({step: "error", message: "This request has expired or was already used. Start connecting again from your AI app."});
        // Already allowed before: Supabase hands back where to go straight away.
        if (!("authorization_id" in data)) {
          setState({step: "leaving"});
          return window.location.assign(data.redirect_url);
        }
        setState({step: "ask", details: data});
      });
  }, [authorizationId]);

  // Approving or denying sends the browser back to the assistant (the library redirects).
  const decide = async (allow: boolean) => {
    if (!authorizationId) return;
    setState({step: "leaving"});
    const oauth = createClient().auth.oauth;
    const {error} = allow ? await oauth.approveAuthorization(authorizationId) : await oauth.denyAuthorization(authorizationId);
    if (error) setState({step: "error", message: "Couldn't send your answer. Start connecting again from your AI app."});
  };

  if (state.step === "loading" || state.step === "leaving") {
    return <p className="text-sm text-white/75">{state.step === "loading" ? "Checking the request…" : "Taking you back to your AI…"}</p>;
  }
  if (state.step === "error") {
    return (
      <>
        <h1 className="text-3xl font-semibold tracking-tight">Can&apos;t connect</h1>
        <p className="mt-3 text-sm text-white/75">{state.message}</p>
        <p className="mt-10 text-sm">
          <Link href="/" className={authLink}>
            Back to Zeflo
          </Link>
        </p>
      </>
    );
  }

  const {client, redirect_uri: redirect, user} = state.details;
  let returnsTo = redirect;
  try {
    returnsTo = new URL(redirect).host;
  } catch {}

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Connect {client.name || "this app"}?</h1>
      <p className="mt-3 text-sm leading-relaxed text-white/75">
        <span className="text-white">{client.name || "An app"}</span> wants to use your Zeflo account
        {user?.email ? (
          <>
            {" "}
            (<span className="text-white">{user.email}</span>)
          </>
        ) : null}
        . It&apos;ll send you back to <span className="text-white">{returnsTo}</span>.
      </p>

      <div className="mt-8 space-y-5 text-sm">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/80">It will be able to</p>
          <ul className="mt-2 space-y-1.5 text-white/85">
            {CAN.map((c) => (
              <li key={c} className="flex gap-2">
                <span className="text-scene-ink" aria-hidden>
                  ✓
                </span>
                {c}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/80">It won&apos;t be able to</p>
          <ul className="mt-2 space-y-1.5 text-white/65">
            {CANNOT.map((c) => (
              <li key={c} className="flex gap-2">
                <span aria-hidden>×</span>
                {c}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-10 flex gap-3">
        <button type="button" onClick={() => decide(false)} className={`${button} border border-white/30 text-white/80 hover:bg-white/[0.06]`}>
          Deny
        </button>
        <button type="button" onClick={() => decide(true)} className={`${button} border border-scene/70 text-scene-ink hover:bg-scene/15`}>
          Allow
        </button>
      </div>
      <p className="mt-6 text-xs text-white/55">Only allow apps you set up yourself. You can disconnect it any time in Settings → AI.</p>
    </>
  );
}
