"use server";

import { revalidatePath } from "next/cache";

import { adminApi, AdminApiError } from "@/lib/admin/api";
import type { PlatformRole } from "@/lib/admin/types";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

function toError(e: unknown): ActionResult {
  return {
    ok: false,
    error:
      e instanceof AdminApiError
        ? e.message
        : "Akcija nije uspjela. Pokušaj ponovno.",
  };
}

export async function updateUserRoleAction(
  userId: string,
  role: PlatformRole,
): Promise<ActionResult> {
  try {
    await adminApi.patch(`/admin/users/${userId}/role`, {
      platform_role: role,
    });
    revalidatePath("/admin/korisnici");
    revalidatePath(`/admin/korisnici/${userId}`);
    return { ok: true };
  } catch (e) {
    return toError(e);
  }
}

export async function updateOrganizationAction(
  orgId: string,
  patch: Partial<{
    is_verified: boolean;
    is_active: boolean;
    can_organize: boolean;
    can_own_venues: boolean;
  }>,
): Promise<ActionResult> {
  try {
    await adminApi.patch(`/admin/organizations/${orgId}`, patch);
    revalidatePath("/admin/organizacije");
    revalidatePath(`/admin/organizacije/${orgId}`);
    return { ok: true };
  } catch (e) {
    return toError(e);
  }
}
