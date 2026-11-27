"use client";

import { useActionState } from "react";
import { requestStudentAccess, type RegistrationState } from "./actions";

const initialState: RegistrationState = { message: "", sent: false };

export function RegistrationForm() {
  const [state, formAction, isPending] = useActionState(requestStudentAccess, initialState);

  return (
    <form action={formAction}>
      <label htmlFor="full_name">Full name as shown on your university record</label>
      <input id="full_name" name="full_name" autoComplete="name" minLength={3} maxLength={120} required />

      <label htmlFor="registration_no">Registration number</label>
      <input id="registration_no" name="registration_no" placeholder="2026-DS-308" autoCapitalize="characters" autoComplete="username" pattern="20[0-9]{2}-[A-Za-z]{2,3}-[0-9]{3}" title="Use the format 2026-DS-308" required />

      <label htmlFor="registration_password">Create UET Hub password</label>
      <input id="registration_password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={72} required />
      <label htmlFor="password_confirmation">Confirm UET Hub password</label>
      <input id="password_confirmation" name="password_confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={72} required />

      <p className="auth-help">Use a new password just for UET Hub—never your LMS password. A class administrator must verify your identity and roster entry before portal access is approved.</p>
      <button className="button button-primary" type="submit" disabled={isPending}>
        {isPending ? "Creating account…" : "Request class access"}
        <span aria-hidden="true">→</span>
      </button>
      {state.message && <p className={`auth-message${state.sent ? "" : " auth-error"}`} role={state.sent ? "status" : "alert"}>{state.message}</p>}
    </form>
  );
}
