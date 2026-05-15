"use client";

import { useTransition } from "react";
import { BadgeCheck, BadgeX, Loader2, MoreHorizontal, Power } from "lucide-react";

import { updateOrganizationAction } from "@/app/admin/actions";
import { toast } from "@/components/Toaster";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function OrgActionsMenu({
  orgId,
  orgName,
  isVerified,
  isActive,
}: {
  orgId: string;
  orgName: string;
  isVerified: boolean;
  isActive: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function apply(
    patch: Partial<{ is_verified: boolean; is_active: boolean }>,
    okMessage: string,
  ) {
    startTransition(async () => {
      const res = await updateOrganizationAction(orgId, patch);
      if (res.ok) toast.success(okMessage, orgName);
      else toast.error("Akcija nije uspjela", res.error);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" disabled={pending}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <MoreHorizontal className="size-4" />
          )}
          <span className="sr-only">Akcije</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Upravljanje</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isVerified ? (
          <DropdownMenuItem
            onClick={() =>
              apply({ is_verified: false }, "Verifikacija uklonjena")
            }
          >
            <BadgeX className="size-4" />
            Ukloni verifikaciju
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={() => apply({ is_verified: true }, "Organizacija verificirana")}
          >
            <BadgeCheck className="size-4" />
            Verificiraj
          </DropdownMenuItem>
        )}
        {isActive ? (
          <DropdownMenuItem
            variant="destructive"
            onClick={() => apply({ is_active: false }, "Organizacija deaktivirana")}
          >
            <Power className="size-4" />
            Deaktiviraj
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={() => apply({ is_active: true }, "Organizacija aktivirana")}
          >
            <Power className="size-4" />
            Aktiviraj
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
