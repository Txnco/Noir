"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ACCESS_COOKIE,
  BACKEND_API_URL,
  REFRESH_COOKIE,
  accessCookieOptions,
  refreshCookieOptions,
} from "./config";
import type {
  LoginResponse,
  RegisterResponse,
} from "../typescript/api-types";

export type AuthState = { error: string | null };

type ApiError = { detail?: string | { msg: string }[] };

function extractError(payload: ApiError, fallback: string): string {
  if (typeof payload.detail === "string") return payload.detail;
  if (Array.isArray(payload.detail) && payload.detail.length > 0) {
    return payload.detail.map((d) => d.msg).join("; ");
  }
  return fallback;
}

async function persistTokens(tokens: LoginResponse["tokens"]) {
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, tokens.access_token, accessCookieOptions(tokens.expires_in));
  if (tokens.refresh_token) {
    jar.set(REFRESH_COOKIE, tokens.refresh_token, refreshCookieOptions());
  }
}

export async function loginAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Unesi email i lozinku." };
  }

  let res: Response;
  try {
    res = await fetch(`${BACKEND_API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
  } catch {
    return { error: "Server nije dostupan. Pokušaj ponovno." };
  }

  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as ApiError;
    return { error: extractError(payload, "Pogrešan email ili lozinka.") };
  }

  const data = (await res.json()) as LoginResponse;
  await persistTokens(data.tokens);
  redirect("/");
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

  if (!firstName) return { error: "Unesi svoje ime." };
  if (!lastName) return { error: "Unesi svoje prezime." };
  if (!email) return { error: "Unesi email." };
  if (password.length < 8) return { error: "Lozinka mora imati barem 8 znakova." };
  if (password !== passwordConfirm) return { error: "Lozinke se ne podudaraju." };
  if (!acceptTerms) return { error: "Moraš prihvatiti uvjete korištenja." };

  let res: Response;
  try {
    res = await fetch(`${BACKEND_API_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName,
        lastName,
        email,
        password,
        password_confirm: passwordConfirm,
      }),
      cache: "no-store",
    });
  } catch {
    return { error: "Server nije dostupan. Pokušaj ponovno." };
  }

  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as ApiError;
    return { error: extractError(payload, "Registracija nije uspjela.") };
  }

  const data = (await res.json()) as RegisterResponse;
  if (data.tokens) {
    await persistTokens(data.tokens);
  }
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  const access = jar.get(ACCESS_COOKIE)?.value;

  if (access) {
    try {
      await fetch(`${BACKEND_API_URL}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${access}` },
        cache: "no-store",
      });
    } catch {
      // best-effort — clear the cookies regardless
    }
  }

  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
  redirect("/");
}
