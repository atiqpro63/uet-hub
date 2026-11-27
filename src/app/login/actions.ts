"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SignInState = { message: string; sent: boolean };
export type RegistrationState = { message: string; sent: boolean };

function normalizedRegistration(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().toUpperCase();
}

function isValidRegistration(value: string) {
  return /^20\d{2}-[A-Z]{2,3}-\d{3}$/.test(value);
}

// Supabase Auth uses an internal email-shaped identifier; students sign in
// with their registration number and never need access to this mailbox.
function authEmailForRegistration(registrationNo: string) {
  return `${registrationNo.replaceAll("-", "").toLowerCase()}@student.uet.edu.pk`;
}

export async function signInWithRegistration(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const registrationNo = normalizedRegistration(formData.get("registration_no"));
  const password = String(formData.get("password") ?? "");

  if (!isValidRegistration(registrationNo) || !password) {
    return { message: "Enter your registration number and UET Hub password.", sent: false };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmailForRegistration(registrationNo),
      password,
    });
    if (error) return { message: "Sign-in failed. Check your details or ask the class administrator for help.", sent: false };
  } catch {
    return { message: "Sign-in is unavailable right now. Please try again later.", sent: false };
  }

  redirect("/dashboard");
}

export async function requestStudentAccess(_previous: RegistrationState, formData: FormData): Promise<RegistrationState> {
  const fullName = String(formData.get("full_name") ?? "").trim().replace(/\s+/g, " ");
  const registrationNo = normalizedRegistration(formData.get("registration_no"));
  const password = String(formData.get("password") ?? "");
  const passwordConfirmation = String(formData.get("password_confirmation") ?? "");

  if (fullName.length < 3 || fullName.length > 120 || !isValidRegistration(registrationNo)) {
    return { message: "Enter your full name and a valid registration number, such as 2026-DS-308.", sent: false };
  }
  if (password.length < 12 || password.length > 72) {
    return { message: "Choose a UET Hub password between 12 and 72 characters. Do not use your LMS password.", sent: false };
  }
  if (password !== passwordConfirmation) {
    return { message: "The passwords do not match.", sent: false };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: authEmailForRegistration(registrationNo),
      password,
      options: {
        data: { full_name: fullName, registration_no: registrationNo },
      },
    });
    if (error) {
      return { message: "We couldn't create this account. If you already registered, sign in or contact the class administrator.", sent: false };
    }
    if (!data.session) {
      return { message: "This project still requires email confirmation. The administrator must turn that setting off before students can register without a mailbox.", sent: false };
    }
  } catch {
    return { message: "Registration is unavailable right now. Please try again later.", sent: false };
  }

  redirect("/dashboard");
}
