"use client";

import {useEffect, useRef, useState} from "react";
import type {OAuthGrant} from "@supabase/supabase-js";
import {formatDay} from "../lib/days";
import {createClient} from "../lib/supabase/client";

// Connecting the user's own AI assistant (Claude, ChatGPT, ...) to Zeflo through the connector at
// /api/mcp: why it's worth it, how to set it up, things to ask, and the assistants already
// connected, each with a way to disconnect it. Opened from Settings.

const PROMPTS = [
  "Plan study sessions for my next test, around my classes.",
  "I'm free tomorrow afternoon. What should I study, and when?",
  "Look at what I finished this week and plan next week better.",
];

const label = "text-[11px] uppercase tracking-[0.25em] text-white/70";
const smallButton =
  "shrink-0 rounded-md bg-white/[0.06] px-2.5 py-1.5 text-[11px] uppercase tracking-[0.15em] text-white/80 transition hover:bg-white/[0.12] hover:text-white";

function Step({n, title, children}: {n: number; title: string; children?: React.ReactNode}) {
  return (
    <li className="flex gap-3">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-scene/60 text-[10px] text-scene-ink" aria-hidden>
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-white/90">{title}</p>
        {children}
      </div>
    </li>
  );
}

// Opens each time `opens` goes up (the parent counts clicks), so it never depends on hearing
// back that the browser closed it (Escape, the backdrop or ×).
export default function AiConnect({opens}: {opens: number}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [grants, setGrants] = useState<OAuthGrant[] | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [address, setAddress] = useState("");

  useEffect(() => {
    const d = dialog.current;
    if (!opens || !d || d.open) return;
    d.showModal();
    setAddress(`${window.location.origin}/api/mcp`);
    createClient()
      .auth.oauth.listGrants()
      .then(({data}) => setGrants(data ?? []));
  }, [opens]);

  const copy = (text: string) =>
    navigator.clipboard.writeText(text).then(() => {
      setCopied(text);
      setTimeout(() => setCopied((c) => (c === text ? null : c)), 1500);
    });

  const disconnect = async (clientId: string) => {
    const {error} = await createClient().auth.oauth.revokeGrant({clientId});
    if (!error) setGrants((g) => g?.filter((x) => x.client.id !== clientId) ?? null);
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby="ai-connect-title"
      // Clicking the dimmed backdrop (the dialog element itself, outside the panel) closes it.
      onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
      className="sf-panel sf-pop m-auto max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border p-0 font-mono text-white [text-shadow:none] backdrop:bg-slate-950/55 backdrop:backdrop-blur-[2px]"
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <p className={label}>Your AI</p>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label="Close"
            className="-m-2 flex h-8 w-8 items-center justify-center rounded-md text-lg leading-none text-white/60 transition hover:bg-white/[0.06] hover:text-white"
          >
            ×
          </button>
        </div>
        <h2 id="ai-connect-title" className="mt-2 text-2xl font-semibold leading-tight tracking-tight">
          Plan with the AI you already use
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-white/75">
          Connect Claude, ChatGPT or another assistant once. Then just tell it what&apos;s coming up, and it plans your study around your classes,
          right on your Zeflo calendar.
        </p>

        <div className="mt-5 rounded-xl border border-scene/30 bg-scene/[0.07] p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-scene-ink">It gets better the more you use it</p>
          <p className="mt-2 text-xs leading-relaxed text-white/80">
            It&apos;s your own AI, so it learns how you study. It sees what you finish and what you skip, remembers what works for you, and adapts
            every plan to fit, the more you plan with it.
          </p>
        </div>

        <ol className="mt-6 space-y-4">
          <Step n={1} title="Copy your connector address">
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md bg-black/25 px-2.5 py-1.5 text-[11px] text-white/85">{address}</code>
              {address && (
                <button type="button" onClick={() => copy(address)} className={smallButton}>
                  {copied === address ? "Copied" : "Copy"}
                </button>
              )}
            </div>
          </Step>
          <Step n={2} title="Add it to your AI app">
            <ul className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-white/60">
              <li>
                <span className="text-white/85">Claude:</span> Settings → Connectors → Add custom connector.
              </li>
              <li>
                <span className="text-white/85">ChatGPT:</span> Settings → Apps &amp; Connectors → Create. If you don&apos;t see it, turn on developer mode
                under Advanced.
              </li>
            </ul>
          </Step>
          <Step n={3} title="Sign in to Zeflo when it asks, and choose Allow" />
        </ol>

        <div className="mt-6">
          <p className={label}>Then try asking</p>
          <ul className="mt-2 space-y-1.5">
            {PROMPTS.map((p) => (
              <li key={p} className="flex items-center gap-2">
                <p className="min-w-0 flex-1 text-xs italic leading-relaxed text-white/80">“{p}”</p>
                <button type="button" onClick={() => copy(p)} className={smallButton}>
                  {copied === p ? "Copied" : "Copy"}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {grants && grants.length > 0 && (
          <div className="mt-6">
            <p className={label}>Connected</p>
            <ul className="mt-2 space-y-1.5">
              {grants.map((g) => (
                <li key={g.client.id} className="flex items-center justify-between gap-2 text-xs text-white/85">
                  <span className="min-w-0 truncate">
                    {g.client.name || "An app"}
                    <span className="text-white/45"> · since {formatDay(g.granted_at.slice(0, 10), {month: "short", day: "numeric"})}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => disconnect(g.client.id)}
                    className="shrink-0 text-[11px] uppercase tracking-[0.15em] text-white/55 underline decoration-white/25 underline-offset-4 transition hover:text-rose-200"
                  >
                    Disconnect
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-6 border-t border-dashed border-white/15 pt-4 text-[11px] leading-relaxed text-white/50">
          Your AI can read your classes and progress and plan your study sessions. It can&apos;t change your classes or settings, or see your
          password, and you can disconnect it here any time.
        </p>
      </div>
    </dialog>
  );
}
