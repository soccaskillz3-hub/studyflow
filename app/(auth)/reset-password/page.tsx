import type {Metadata} from "next";
import {cookies} from "next/headers";
import {cancelPasswordReset} from "../../lib/auth";
import {requireUser} from "../../lib/dal";
import {RESET_PENDING_COOKIE} from "../../lib/resetPending";
import {ResetPasswordForm} from "../forms";

export const metadata: Metadata = {title: "Choose a new password · Zeflo"};

// Reached from the reset email's link, which logs the person in first. Until they save a new
// password or cancel, the proxy keeps them here.
export default async function ResetPasswordPage() {
  const user = await requireUser();
  const fromResetLink = (await cookies()).has(RESET_PENDING_COOKIE);
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Choose a new password</h1>
      <p className="mt-3 text-sm text-white/75">For {user.email}.</p>
      <div className="mt-10">
        <ResetPasswordForm />
      </div>
      {fromResetLink && (
        <form action={cancelPasswordReset} className="mt-12 text-sm text-white/75">
          Remembered it after all?{" "}
          <button
            type="submit"
            className="text-scene-soft underline decoration-scene/40 underline-offset-4 transition hover:text-scene-ink"
          >
            Log in with your password
          </button>
        </form>
      )}
    </>
  );
}
