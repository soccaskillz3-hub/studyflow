import type {Metadata} from "next";
import {requireUser} from "../../lib/dal";
import {ResetPasswordForm} from "../forms";

export const metadata: Metadata = {title: "Choose a new password · StudyFlow"};

// Reached from the reset email's link, which logs the person in first.
export default async function ResetPasswordPage() {
  const user = await requireUser();
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Choose a new password</h1>
      <p className="mt-3 text-sm text-white/75">For {user.email}.</p>
      <div className="mt-10">
        <ResetPasswordForm />
      </div>
    </>
  );
}
