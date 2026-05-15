"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { BACKEND_API_URL } from "./config";
import type { ProfileOut, ProfileUpdate } from "../typescript/api-types";

export type ProfileUpdateResult =
  | { status: "success"; profile: ProfileOut }
  | { status: "error"; error: string };

/**
 * Submits a profile patch to the backend on behalf of the logged-in user.
 * The backend trusts the Supabase JWT (no user_id needed in the payload).
 */
export async function updateProfileAction(
  patch: ProfileUpdate,
): Promise<ProfileUpdateResult> {
  const supabase = await supabaseServer();
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  if (!token) {
    return { status: "error", error: "Sesija je istekla. Prijavi se ponovno." };
  }

  try {
    const res = await fetch(`${BACKEND_API_URL}/profiles/me`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(patch),
      cache: "no-store",
    });

    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      const message =
        typeof detail?.detail === "string"
          ? detail.detail
          : "Spremanje nije uspjelo. Pokušaj ponovno.";
      return { status: "error", error: message };
    }

    const profile = (await res.json()) as ProfileOut;
    revalidatePath("/profil");
    return { status: "success", profile };
  } catch {
    return {
      status: "error",
      error: "Greška u komunikaciji s poslužiteljem.",
    };
  }
}
