"use server";

import { supabaseServer } from "@/lib/supabase/server";
import type { AuthState } from "./types";

export async function loginAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { status: "error", error: "Unesi email i lozinku.", code: "missing_fields" };
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Supabase returns 400 for both wrong password and unknown email —
    // deliberately generic to prevent email enumeration.
    if (error.message.toLowerCase().includes("email not confirmed")) {
      return {
        status: "error",
        error: "Potvrdi email prije prijave. Poslali smo ti link.",
        code: "email_not_confirmed",
      };
    }
    return {
      status: "error",
      error: "Pogrešan email ili lozinka.",
      code: "invalid_credentials",
    };
  }

  return {
    status: "success",
    message: "Prijava uspješna. Dobrodošao natrag!",
    redirectTo: "/",
  };
}

export async function registerAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("password_confirm") ?? "");
  const acceptTerms = formData.get("acceptTerms") === "on";

  if (!firstName) return { status: "error", error: "Unesi svoje ime.", code: "missing_firstName" };
  if (!lastName) return { status: "error", error: "Unesi svoje prezime.", code: "missing_lastName" };
  if (!email) return { status: "error", error: "Unesi email.", code: "missing_email" };
  if (password.length < 8)
    return { status: "error", error: "Lozinka mora imati barem 8 znakova.", code: "weak_password" };
  if (password !== passwordConfirm)
    return { status: "error", error: "Lozinke se ne podudaraju.", code: "password_mismatch" };
  if (!acceptTerms)
    return { status: "error", error: "Moraš prihvatiti uvjete korištenja.", code: "terms_required" };

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { firstName, lastName } },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("already") || msg.includes("registered")) {
      return {
        status: "error",
        error: "Korisnik s tim emailom već postoji. Prijavi se umjesto toga.",
        code: "email_exists",
      };
    }
    if (msg.includes("password")) {
      return { status: "error", error: "Lozinka nije dovoljno sigurna.", code: "weak_password" };
    }
    return {
      status: "error",
      error: "Registracija nije uspjela. Pokušaj ponovno.",
      code: "signup_failed",
    };
  }

  // Supabase's anti-enumeration behaviour: when an email already exists and
  // "Confirm email" is ON, signUp returns a fake user with identities=[].
  // We MUST catch this — otherwise we'd silently "succeed" on duplicate emails.
  if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
    return {
      status: "error",
      error: "Korisnik s tim emailom već postoji. Prijavi se umjesto toga.",
      code: "email_exists",
    };
  }

  if (!data.session) {
    return {
      status: "success",
      message: "Račun kreiran. Provjeri email za potvrdu računa.",
      redirectTo: "/prijava",
    };
  }

  return {
    status: "success",
    message: "Račun kreiran. Dobrodošao u Noir!",
    redirectTo: "/",
  };
}

export async function logoutAction(): Promise<AuthState> {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  return { status: "success", message: "Odjava uspješna.", redirectTo: "/" };
}
