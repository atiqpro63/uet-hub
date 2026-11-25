"use client";

import { useActionState } from "react";
import { sendSignInLink, type SignInState } from "./actions";

const initialState: SignInState = { message: "", sent: false };

export function SignInForm() {
  const [state, formAction, isPending] = useActionState(sendSignInLink, initialState);

  return (
    <form action={formAction}>
      <label htmlFor="email">University email</label>
      <input id="email" name="email" type="email" autoComplete="email" placeholder="name@university.edu" required />
      <button className="button button-primary" type="submit" disabled={isPending}>
        {isPending ? "Sending link…" : "Email me a sign-in link"}
        <span aria-hidden="true">→</span>
      </button>
      {state.message && <p className="auth-message" role="status">{state.message}</p>}
      <p className="auth-help">Already registered? Sign in here. New students can request access below; class membership still requires roster approval.</p>
    </form>
  );
}
