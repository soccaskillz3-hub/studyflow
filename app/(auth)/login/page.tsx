import type {Metadata} from "next";
import Link from "next/link";
import {authLink} from "../../components/AuthForm";
import DevLogin from "../../components/DevLogin";
import {LoginForm} from "../forms";

export const metadata: Metadata = {title: "Log in · Zeflo"};

const NOTICES: Record<string, string> = {
  // Also where Supabase's default confirmation link lands when it's opened in a different browser
  // from the one used to sign up: the email is confirmed by then, so logging in works.
  link: "If you just confirmed your email, you're all set: log in below. Otherwise that link has expired or was already used.",
};

export default async function LoginPage({searchParams}: PageProps<"/login">) {
  const {next, error} = await searchParams;
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-3 text-sm text-white/75">Log in to your study day.</p>
      <div className="mt-10">
        <LoginForm
          next={typeof next === "string" ? next : "/"}
          notice={typeof error === "string" ? NOTICES[error] : undefined}
        />
      </div>
      <p className="mt-12 text-sm text-white/75">
        New to Zeflo?{" "}
        <Link href="/signup" className={authLink}>
          Create an account
        </Link>
      </p>
      <DevLogin />
    </>
  );
}
