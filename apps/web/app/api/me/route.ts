import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import type { Viewer } from "@/lib/typescript/api-types";

/**
 * Returns only what the client-side header needs. Role and membership
 * data stay server-side — fetch them in server components via
 * getCurrentUser() when gating UI on authority.
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
  };
  return NextResponse.json({ viewer });
}
