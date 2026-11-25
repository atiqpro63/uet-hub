"use server";

import { createClient } from "@/lib/supabase/server";

export type SignInState = { message: string; sent: boolean };
export type RegistrationState = { message: string; sent: boolean };

function authRedirectUrl() {
  const configuredSite = process.env.NEXT_PUBLIC_SITE_URL;
  const vercelHost = process.env.VERCEL_URL;
  const siteUrl = process.env.VERCEL_ENV === "production" && configuredSite
    ? configuredSite
    : vercelHost
      ? `https://${vercelHost}`
      : configuredSite || "http://localhost:3000";
  return new URL("/auth/callback?next=/dashboard", siteUrl).toString();
}

export async function sendSignInLink(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { message: "Enter a valid email address.", sent: false };
  }

  try {
    const supabase = await createClient();
    await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: authRedirectUrl(),
      },
    });
  } catch {
    // Keep the response generic so the page does not disclose whether an account exists.
  }

  return {
    message: "If your department account is approved, a secure sign-in link will arrive shortly.",
    sent: true,
  };
}

export async function requestStudentAccess(_previous: RegistrationState, formData: FormData): Promise<RegistrationState> {
  const fullName = String(formData.get("full_name") ?? "").trim().replace(/\s+/g, " ");
  const registrationNo = String(formData.get("registration_no") ?? "").trim().toUpperCase();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const validRegistration = /^\d{4}-[A-Z]{2,3}-\d{3}$/.test(registrationNo);
  const expectedEmail = `${registrationNo.replaceAll("-", "").toLowerCase()}@student.uet.edu.pk`;

  if (fullName.length < 3 || fullName.length > 120 || !validRegistration || email !== expectedEmail) {
    return {
      message: "Check your name, registration number, and university email. The email must match your registration number (for example, 2026-DS-308 uses 2026ds308@student.uet.edu.pk).",
      sent: false,
    };
  }

  try {
    const supabase = await createClient();
    await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: authRedirectUrl(),
        data: { full_name: fullName, registration_no: registrationNo },
      },
    });
  } catch {
    // Keep this generic: don't disclose whether an email already has an account.
  }

  return {
    message: "If this university account can be registered, a secure link will arrive by email. Your account will still need class roster approval before you can use the portal.",
    sent: true,
  };
}
