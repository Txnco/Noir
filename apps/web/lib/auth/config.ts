export const BACKEND_API_URL =
  process.env.BACKEND_API_URL ?? "http://localhost:8000/api/v1";

export const ACCESS_COOKIE = "noir_access";
export const REFRESH_COOKIE = "noir_refresh";

export const accessCookieOptions = (maxAgeSeconds: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: maxAgeSeconds,
});

export const refreshCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
});
