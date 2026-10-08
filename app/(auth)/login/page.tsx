import type {Metadata} from "next";
import Link from "next/link";
import {authLink} from "../../components/AuthForm";
import DevLogin from "../../components/DevLogin";
import {LoginForm} from "../forms";

export const metadata: Metadata = {title: "Log in · StudyFlow"};

const NOTICES: Record<string, string> = {
  link: "That link has expired or was already used. Log in, or ask for a new one.",
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
        New to StudyFlow?{" "}
        <Link href="/signup" className={authLink}>
          Create an account
        </Link>
      </p>
      <DevLogin />
    </>
  );
}
