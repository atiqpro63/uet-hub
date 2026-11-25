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
      <input id="registration_no" name="registration_no" placeholder="2026-DS-308" autoCapitalize="characters" pattern="[0-9]{4}-[A-Za-z]{2,3}-[0-9]{3}" title="Use the format 2026-DS-308" required />

      <label htmlFor="registration_email">University student email</label>
      <input id="registration_email" name="email" type="email" autoComplete="email" placeholder="2026ds308@student.uet.edu.pk" required />

      <button className="button button-primary" type="submit" disabled={isPending}>
        {isPending ? "Sending secure link…" : "Request class access"}
        <span aria-hidden="true">→</span>
      </button>
      {state.message && <p className={`auth-message${state.sent ? "" : " auth-error"}`} role={state.sent ? "status" : "alert"}>{state.message}</p>}
    </form>
  );
}
