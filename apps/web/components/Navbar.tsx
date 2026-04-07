"use client";

import { useState, useEffect, type ReactNode } from "react";
import Link from "next/link";

interface NavLink {
  label: string;
  href: string;
}

interface NavbarProps {
  links?: NavLink[];
  cta?: { label: string; href: string };
  transparent?: boolean;
  children?: ReactNode;
}

const defaultLinks: NavLink[] = [
  { label: "Kako radi", href: "/#kako-radi" },
  { label: "Za organizatore", href: "/#za-organizatore" },
  { label: "Kontakt", href: "/#kontakt" },
];

export default function Navbar({
  links = defaultLinks,
  cta = { label: "Pregledaj evente", href: "/eventi" },
  transparent = false,
  children,
}: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 right-0 left-0 z-50 transition-all duration-300 ${
        scrolled || !transparent
          ? "nav-glass"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="font-display text-xl font-extrabold tracking-[0.18em] text-primary select-none"
        >
          NOIR
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-text-muted transition-colors hover:text-primary"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/prijava"
            className="text-sm font-medium text-text-muted transition-colors hover:text-primary"
          >
            Prijava
          </Link>
          <a
            href={cta.href}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-neutral hover:shadow-md active:scale-[0.97]"
          >
            {cta.label}
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-surface md:hidden"
          aria-label="Otvori izbornik"
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            {mobileOpen ? (
              <path
                d="M6 6l10 10M16 6L6 16"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            ) : (
              <>
                <path d="M4 6h14M4 11h14M4 16h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Optional sub-bar (e.g. filter pills) — rendered inside the same nav so it shares one backdrop-filter */}
      {children}

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-border bg-surface-white/95 backdrop-blur-lg md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-6 py-4">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-4 py-3 text-sm font-medium text-text-muted transition-colors hover:bg-surface hover:text-primary"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
              <Link
                href="/prijava"
                onClick={() => setMobileOpen(false)}
                className="block rounded-lg px-4 py-3 text-center text-sm font-medium text-text-muted transition-colors hover:bg-surface hover:text-primary"
              >
                Prijava
              </Link>
              <a
                href={cta.href}
                onClick={() => setMobileOpen(false)}
                className="block rounded-full bg-primary px-5 py-3 text-center text-sm font-semibold text-white shadow-sm transition-all hover:bg-neutral active:scale-[0.97]"
              >
                {cta.label}
              </a>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
