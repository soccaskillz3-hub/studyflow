import type {Metadata} from "next";
import Link from "next/link";
import {authLink} from "../../components/AuthForm";
import {ForgotPasswordForm} from "../forms";

export const metadata: Metadata = {title: "Reset your password · Zeflo"};

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Forgot your password?</h1>
      <p className="mt-3 text-sm text-white/75">Enter your email and we&apos;ll send you a link to choose a new one.</p>
      <div className="mt-10">
        <ForgotPasswordForm />
      </div>
      <p className="mt-12 text-sm text-white/75">
        Remembered it?{" "}
        <Link href="/login" className={authLink}>
          Log in
        </Link>
      </p>
    </>
  );
}
