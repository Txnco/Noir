import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import type { Viewer } from "@/lib/typescript/api-types";

/**
 * Returns what the client-side header needs. `platformRole` is included
 * so the avatar menu can surface the admin dashboard link; the admin
 * routes themselves are still gated server-side on every request.
 * Membership data stays server-side.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ viewer: null });

  const viewer: Viewer = {
    id: user.id,
    email: user.email ?? null,
    firstName: user.profile.first_name ?? null,
    lastName: user.profile.last_name ?? null,
    avatarUrl: user.profile.avatar_url ?? null,
    platformRole: user.platform_role ?? null,
  };
  return NextResponse.json({ viewer });
}
