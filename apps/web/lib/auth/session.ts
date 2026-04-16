import { cache } from "react";
import { supabaseServer } from "@/lib/supabase/server";
import { BACKEND_API_URL } from "./config";
import type { CurrentUserResponse } from "../typescript/api-types";

/**
 * Returns the authenticated user. Supabase owns identity, `profiles`
 * (served by the backend /auth/me) owns display data. If the backend
 * is unreachable we still return a valid "logged in" shape with an
 * empty profile — the header must not flip to guest state while
 * Supabase cookies are valid, or the user gets trapped (proxy blocks
 * /prijava for authenticated sessions).
 *
 * Names are NEVER read from `user_metadata` — that store is frozen
 * at signup and diverges from `profiles` on any edit.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUserResponse | null> => {
  const supabase = await supabaseServer();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) return null;

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  if (token) {
    try {
      const res = await fetch(`${BACKEND_API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (res.ok) return (await res.json()) as CurrentUserResponse;
    } catch {
      // Fall through to the skeleton below.
    }
  }

  const u = userData.user;
  return {
    id: u.id,
    email: u.email ?? null,
    email_verified: Boolean(u.email_confirmed_at),
    profile: {
      id: u.id,
      first_name: null,
      last_name: null,
      avatar_url: null,
      city: null,
      phone: null,
      claimed_at: null,
      created_at: u.created_at,
    },
    platform_role: "user",
    memberships: [],
  };
});
