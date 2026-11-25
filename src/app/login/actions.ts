"use server";

import { createClient } from "@/lib/supabase/server";

export type SignInState = { message: string; sent: boolean };

export async function sendSignInLink(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { message: "Enter a valid email address.", sent: false };
  }

  try {
    const supabase = await createClient();
    const configuredSite = process.env.NEXT_PUBLIC_SITE_URL;
    const vercelHost = process.env.VERCEL_URL;
    const siteUrl = configuredSite || (vercelHost ? `https://${vercelHost}` : "http://localhost:3000");
    await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: new URL("/auth/callback?next=/dashboard", siteUrl).toString(),
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
