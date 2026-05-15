"use client";

import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export default function Pagination({
  page,
  totalPages,
  total,
}: {
  page: number;
  totalPages: number;
  total: number;
}) {
  const pathname = usePathname();
  const params = useSearchParams();

  function hrefFor(target: number) {
    const next = new URLSearchParams(params.toString());
    next.set("page", String(target));
    return `${pathname}?${next.toString()}`;
  }

  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  return (
    <div className="flex items-center justify-between gap-3 pt-1">
      <p className="text-muted-foreground text-sm">
        Stranica {page} / {totalPages} · {total.toLocaleString("hr-HR")} ukupno
      </p>
      <div className="flex gap-1.5">
        <Link
          href={prevDisabled ? "#" : hrefFor(page - 1)}
          aria-disabled={prevDisabled}
          tabIndex={prevDisabled ? -1 : undefined}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            prevDisabled && "pointer-events-none opacity-50",
          )}
        >
          <ChevronLeft className="size-4" />
          Prethodna
        </Link>
        <Link
          href={nextDisabled ? "#" : hrefFor(page + 1)}
          aria-disabled={nextDisabled}
          tabIndex={nextDisabled ? -1 : undefined}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            nextDisabled && "pointer-events-none opacity-50",
          )}
        >
          Sljedeća
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
