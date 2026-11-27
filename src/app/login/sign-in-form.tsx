"use client";

import { useActionState } from "react";
import { signInWithRegistration, type SignInState } from "./actions";

const initialState: SignInState = { message: "", sent: false };

export function SignInForm() {
  const [state, formAction, isPending] = useActionState(signInWithRegistration, initialState);

  return (
    <form action={formAction}>
      <label htmlFor="login_registration_no">Registration number</label>
      <input id="login_registration_no" name="registration_no" placeholder="2026-DS-308" autoCapitalize="characters" autoComplete="username" pattern="20[0-9]{2}-[A-Za-z]{2,3}-[0-9]{3}" title="Use the format 2026-DS-308" required />
      <label htmlFor="login_password">UET Hub password</label>
      <input id="login_password" name="password" type="password" autoComplete="current-password" required />
      <button className="button button-primary" type="submit" disabled={isPending}>
        {isPending ? "Signing in…" : "Sign in"}
        <span aria-hidden="true">→</span>
      </button>
      {state.message && <p className={`auth-message${state.sent ? "" : " auth-error"}`} role={state.sent ? "status" : "alert"}>{state.message}</p>}
      <p className="auth-help">Use a password made for UET Hub only. If you forget it, contact the class administrator.</p>
    </form>
  );
}
