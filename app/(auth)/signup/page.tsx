import type {Metadata} from "next";
import Link from "next/link";
import {authLink} from "../../components/AuthForm";
import {SignupForm} from "../forms";

export const metadata: Metadata = {title: "Create an account · Zeflo"};

export default function SignupPage() {
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-3 text-sm text-white/75">Your schedule and progress are private to you.</p>
      <div className="mt-10">
        <SignupForm />
      </div>
      <p className="mt-12 text-sm text-white/75">
        Already have an account?{" "}
        <Link href="/login" className={authLink}>
          Log in
        </Link>
      </p>
    </>
  );
}
