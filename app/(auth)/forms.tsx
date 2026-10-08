"use client";

import Link from "next/link";
import {useActionState} from "react";
import {authLink, EmailSent, Field, FormError, SubmitButton} from "../components/AuthForm";
import {logIn, requestPasswordReset, signUp, updatePassword} from "../lib/auth";

export function LoginForm({next, notice}: {next: string; notice?: string}) {
  const [state, action] = useActionState(logIn, null);
  return (
    <form action={action} className="space-y-7">
      <input type="hidden" name="next" value={next} />
      <Field label="Email" name="email" type="email" autoComplete="email" autoFocus />
      <Field label="Password" name="password" type="password" autoComplete="current-password" />
      <FormError>{state?.error ?? notice}</FormError>
      <SubmitButton pendingText="Logging in…">Log in</SubmitButton>
      <p className="text-right text-xs">
        <Link href="/forgot-password" className={authLink}>
          Forgot your password?
        </Link>
      </p>
    </form>
  );
}

export function SignupForm() {
  const [state, action] = useActionState(signUp, null);
  if (state?.sent) {
    return (
      <EmailSent title="Check your email">
        We sent a link to <span className="text-white">{state.sent}</span>. Open it to confirm your account, and
        you&apos;re in.
      </EmailSent>
    );
  }
  return (
    <form action={action} className="space-y-7">
      <Field label="Email" name="email" type="email" autoComplete="email" autoFocus />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters."
      />
      <FormError>{state?.error}</FormError>
      <SubmitButton pendingText="Creating your account…">Create account</SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, null);
  if (state?.sent) {
    return (
      <EmailSent title="Check your email">
        If there&apos;s an account for <span className="text-white">{state.sent}</span>, we&apos;ve sent it a link to
        choose a new password.
      </EmailSent>
    );
  }
  return (
    <form action={action} className="space-y-7">
      <Field label="Email" name="email" type="email" autoComplete="email" autoFocus />
      <FormError>{state?.error}</FormError>
      <SubmitButton pendingText="Sending…">Send reset link</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action] = useActionState(updatePassword, null);
  return (
    <form action={action} className="space-y-7">
      <Field
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters."
        autoFocus
      />
      <FormError>{state?.error}</FormError>
      <SubmitButton pendingText="Saving…">Save password</SubmitButton>
    </form>
  );
}
