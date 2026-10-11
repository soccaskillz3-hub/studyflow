"use client";

import {useActionState, useEffect, useRef, useState} from "react";
import {useFormStatus} from "react-dom";
import {deleteAccount} from "../lib/auth";
import {FormError} from "./AuthForm";

// Deleting your account for good, from Settings. Asks for "DELETE" to be typed first, then the
// server removes the login and everything in it and shows the welcome page. Opens each time
// `opens` goes up, like the Your AI window (keyed by it too, so each opening starts blank).

const CONFIRM = "DELETE";

function DeleteButton({ready}: {ready: boolean}) {
  const {pending} = useFormStatus();
  return (
    <button
      type="submit"
      disabled={!ready || pending}
      className="rounded-md border border-rose-300/50 bg-rose-400/15 px-3 py-2 text-[11px] uppercase tracking-[0.15em] text-rose-100 transition hover:bg-rose-400/25 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {pending ? "Deleting…" : "Delete my account"}
    </button>
  );
}

export default function DeleteAccount({opens}: {opens: number}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  const [state, action] = useActionState(deleteAccount, null);

  useEffect(() => {
    const d = dialog.current;
    if (!opens || !d || d.open) return;
    d.showModal();
  }, [opens]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="delete-account-title"
      onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
      className="sf-panel sf-pop m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border p-0 font-mono text-white [text-shadow:none] backdrop:bg-slate-950/55 backdrop:backdrop-blur-[2px]"
    >
      <form action={action} className="p-5 sm:p-6">
        <p className="text-[11px] uppercase tracking-[0.25em] text-rose-200/80">Delete account</p>
        <h2 id="delete-account-title" className="mt-2 text-xl font-semibold leading-tight tracking-tight">
          Delete your Zeflo account?
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-white/75">
          This deletes your account and everything in it straight away: your classes, study sessions, progress and settings. Any AI apps you
          connected are disconnected. It can&apos;t be undone.
        </p>

        <label className="mt-5 block">
          <span className="text-xs text-white/80">
            Type <span className="font-semibold text-white">{CONFIRM}</span> to confirm
          </span>
          <input
            name="confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="mt-2 w-full rounded-md border border-white/20 bg-black/25 px-3 py-2 text-sm tracking-[0.2em] text-white outline-none transition focus:border-rose-300/60"
          />
        </label>

        <div className="mt-3 min-h-5">
          <FormError>{state?.error}</FormError>
        </div>

        <div className="mt-3 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="rounded-md px-3 py-2 text-[11px] uppercase tracking-[0.15em] text-white/70 transition hover:bg-white/[0.06] hover:text-white"
          >
            Cancel
          </button>
          <DeleteButton ready={typed.trim() === CONFIRM} />
        </div>
      </form>
    </dialog>
  );
}
