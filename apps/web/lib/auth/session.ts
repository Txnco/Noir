import { cookies } from "next/headers";
import { cache } from "react";
import { ACCESS_COOKIE, BACKEND_API_URL } from "./config";
import type { CurrentUserResponse } from "../typescript/api-types";

export const getCurrentUser = cache(async (): Promise<CurrentUserResponse | null> => {
  const jar = await cookies();
  const token = jar.get(ACCESS_COOKIE)?.value;
  if (!token) return null;

  try {
    const res = await fetch(`${BACKEND_API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as CurrentUserResponse;
  } catch {
    return null;
  }
});
