"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logoutAction } from "@/lib/auth/actions";
import { toast } from "@/components/Toaster";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Viewer } from "@/lib/typescript/api-types";

type Props = {
  variant?: "desktop" | "mobile";
  onNavigate?: () => void;
};

function initialsOf(v: Viewer): string {
  const f = v.firstName?.[0] ?? "";
  const l = v.lastName?.[0] ?? "";
  return (f + l).toUpperCase() || v.email?.[0]?.toUpperCase() || "?";
}

export default function UserMenu({ variant = "desktop", onNavigate }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<Viewer | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [pendingLogout, startLogout] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  function handleLogout() {
    startLogout(async () => {
      const result = await logoutAction();
      // Also sign out in-browser so onAuthStateChange fires and UI updates
      // even if the pathname stays the same after redirect.
      await supabaseBrowser().auth.signOut();
      setUser(null);
      onNavigate?.();
      if (result.status === "success") {
        toast.success("Odjavljen si", result.message);
        router.replace(result.redirectTo);
        router.refresh();
      } else if (result.status === "error") {
        toast.error("Odjava nije uspjela", result.error);
      }
    });
  }

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      try {
        const r = await fetch("/api/me", { cache: "no-store" });
        const data = r.ok ? await r.json() : { viewer: null };
        if (!cancelled) {
          setUser(data.viewer ?? null);
          setLoaded(true);
        }
      } catch {
        if (!cancelled) setLoaded(true);
      }
    }

    loadUser();

    const supabase = supabaseBrowser();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      loadUser();
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Skeleton during initial fetch — prevents flicker between guest/auth states
  if (!loaded) {
    return variant === "desktop" ? (
      <div className="h-9 w-9 animate-pulse rounded-full bg-surface" />
    ) : (
      <div className="h-10 w-full animate-pulse rounded-lg bg-surface" />
    );
  }

  // Guest — show login + CTA
  if (!user) {
    if (variant === "desktop") {
      return (
        <Link
          href="/prijava"
          className="text-sm font-medium text-text-muted transition-colors hover:text-primary"
        >
          Prijava
        </Link>
      );
    }
    return (
      <Link
        href="/prijava"
        onClick={onNavigate}
        className="block rounded-lg px-4 py-3 text-center text-sm font-medium text-text-muted transition-colors hover:bg-surface hover:text-primary"
      >
        Prijava
      </Link>
    );
  }

  const initials = initialsOf(user);
  const fullName =
    `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email || "";

  if (variant === "mobile") {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-neutral">{fullName}</p>
            <p className="truncate text-xs text-text-muted">{user.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={pendingLogout}
          className="block w-full rounded-lg px-4 py-3 text-left text-sm font-medium text-text-muted transition-colors hover:bg-surface hover:text-primary disabled:opacity-60"
        >
          {pendingLogout ? "Odjavljivanje..." : "Odjava"}
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white shadow-sm transition-all hover:bg-neutral focus:outline-none focus:ring-4 focus:ring-accent/25"
      >
        {initials}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-60 origin-top-right overflow-hidden rounded-2xl border border-border bg-surface-white shadow-xl"
        >
          <div className="border-b border-border px-4 py-3">
            <p className="truncate text-sm font-semibold text-neutral">{fullName}</p>
            <p className="truncate text-xs text-text-muted">{user.email}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            disabled={pendingLogout}
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-text-muted transition-colors hover:bg-surface hover:text-primary disabled:opacity-60"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M9 11l3-3-3-3M12 8H5M5 3H3v10h2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {pendingLogout ? "Odjavljivanje..." : "Odjava"}
          </button>
        </div>
      )}
    </div>
  );
}
