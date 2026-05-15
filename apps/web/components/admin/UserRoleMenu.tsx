"use client";

import { useTransition } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";

import type { PlatformRole } from "@/lib/admin/types";
import { updateUserRoleAction } from "@/app/admin/actions";
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

const ROLES: { value: PlatformRole; label: string }[] = [
  { value: "super_admin", label: "Super admin" },
  { value: "support", label: "Podrška" },
  { value: "finance_admin", label: "Financije" },
  { value: "user", label: "Korisnik" },
];

export default function UserRoleMenu({
  userId,
  current,
  userLabel,
}: {
  userId: string;
  current: PlatformRole;
  userLabel: string;
}) {
  const [pending, startTransition] = useTransition();

  function change(role: PlatformRole) {
    if (role === current) return;
    startTransition(async () => {
      const res = await updateUserRoleAction(userId, role);
      if (res.ok) {
        toast.success("Uloga ažurirana", `${userLabel} → ${labelFor(role)}`);
      } else {
        toast.error("Promjena nije uspjela", res.error);
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={pending}>
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <ChevronDown className="size-3.5" />
          )}
          Uloga
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Platformska uloga</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ROLES.map((r) => (
          <DropdownMenuItem key={r.value} onClick={() => change(r.value)}>
            <span className="flex-1">{r.label}</span>
            {r.value === current && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function labelFor(role: PlatformRole) {
  return ROLES.find((r) => r.value === role)?.label ?? role;
}
