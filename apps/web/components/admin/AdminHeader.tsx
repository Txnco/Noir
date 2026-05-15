"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { ExternalLink, LogOut } from "lucide-react";

import { adminTitleFor } from "@/lib/admin/nav";
import { logoutAction } from "@/lib/auth/actions";
import { toast } from "@/components/Toaster";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = {
  name: string;
  email: string;
};

export default function AdminHeader({ name, email }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const initials =
    name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  function handleLogout() {
    startTransition(async () => {
      const result = await logoutAction();
      if (result.status === "success") {
        toast.success("Odjavljen si", result.message);
        router.replace(result.redirectTo);
        router.refresh();
      } else if (result.status === "error") {
        toast.error("Odjava nije uspjela", result.error);
      }
    });
  }

  return (
    <header className="bg-background/85 sticky top-0 z-10 flex h-14 items-center gap-3 border-b px-4 backdrop-blur">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="!h-5" />
      <h1 className="font-display text-base font-semibold">
        {adminTitleFor(pathname)}
      </h1>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/" target="_blank">
            <ExternalLink className="size-4" />
            <span className="hidden sm:inline">Stranica</span>
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-full text-xs font-semibold">
              {initials}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="grid leading-tight">
              <span className="truncate">{name}</span>
              <span className="text-muted-foreground truncate text-xs font-normal">
                {email}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={pending}
              onClick={handleLogout}
            >
              <LogOut className="size-4" />
              {pending ? "Odjavljivanje…" : "Odjava"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
