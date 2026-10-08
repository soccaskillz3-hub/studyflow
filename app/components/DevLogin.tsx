"use client";

import {useActionState} from "react";
import {useFormStatus} from "react-dom";
import {devLogIn} from "../lib/devAuth";

function AccountButton({account, label}: {account: "a" | "b"; label: string}) {
  const {pending} = useFormStatus();
  return (
    <button
      type="submit"
      name="account"
      value={account}
      disabled={pending}
      className="border border-dashed border-amber-200/60 px-4 py-2 text-xs uppercase tracking-[0.2em] text-amber-100 transition hover:bg-amber-200/10 disabled:cursor-wait disabled:opacity-60"
    >
      {label}
    </button>
  );
}

// Shown only by `npm run dev` (see app/lib/devAuth.ts): log straight in to a test account.
export default function DevLogin() {
  const [state, action] = useActionState(devLogIn, null);
  if (process.env.NODE_ENV !== "development") return null;

  return (
    <form action={action} className="mt-12 border-t border-dashed border-amber-200/30 pt-5">
      <p className="text-[11px] uppercase tracking-[0.3em] text-amber-200/80">Development only</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <AccountButton account="a" label="Dev login" />
        <AccountButton account="b" label="Dev login (account B)" />
      </div>
      {state?.error && (
        <p role="alert" className="mt-3 text-sm text-rose-300">
          {state.error}
        </p>
      )}
    </form>
  );
}
