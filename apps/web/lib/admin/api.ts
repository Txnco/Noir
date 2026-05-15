import "server-only";

import { supabaseServer } from "@/lib/supabase/server";
import { BACKEND_API_URL } from "@/lib/auth/config";

/**
 * Authenticated fetch against the backend admin endpoints. Forwards the
 * caller's Supabase access token; the backend re-checks the platform role
 * on every request, so this layer never trusts the client.
 */
async function adminFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    throw new AdminApiError("Niste prijavljeni.", 401);
  }

  const res = await fetch(`${BACKEND_API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    let detail = `Zahtjev nije uspio (${res.status}).`;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      // keep the default message
    }
    throw new AdminApiError(detail, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export class AdminApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
  }
}

function qs(params: Record<string, string | number | boolean | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const adminApi = {
  get: <T>(path: string) => adminFetch<T>(path),
  patch: <T>(path: string, body: unknown) =>
    adminFetch<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  qs,
};
