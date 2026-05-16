"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Logo from "@/components/Logo";
import UserMenu from "@/components/UserMenu";
import ExpandableSearch from "@/components/ExpandableSearch";

interface NavLink {
  label: string;
  href: string;
}

interface NavbarProps {
  links?: NavLink[];
  cta?: { label: string; href: string };
  transparent?: boolean;
  // Optional — eventi page only
  search?: string;
  onSearchChange?: (val: string) => void;
  activeFilterCount?: number;
  onFilterOpen?: () => void;
}

const defaultLinks: NavLink[] = [
  { label: "Kako radi", href: "/#kako-radi" },
  { label: "Za organizatore", href: "/#za-organizatore" },
  { label: "Kontakt", href: "/#kontakt" },
];

function FilterTrigger({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={`Otvori filtere${count > 0 ? `, ${count} aktivnih` : ""}`}
      className="relative flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M3 5h18M6 12h12M9 19h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      {count > 0 && (
        <span className="absolute -top-1 -right-1 flex min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </button>
  );
}

export default function Navbar({
  links = defaultLinks,
  cta = { label: "Pregledaj evente", href: "/eventi" },
  transparent = false,
  search,
  onSearchChange,
  activeFilterCount = 0,
  onFilterOpen,
}: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const hasFilterProps = onSearchChange !== undefined || onFilterOpen !== undefined;

  return (
    <nav
      className={`fixed top-0 right-0 left-0 z-50 transition-all duration-300 ${
        scrolled || !transparent ? "nav-glass" : "bg-transparent"
      }`}
    >
      <motion.div layout className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Logo href="/" height={48} />

        {/* Desktop nav links — fade out when search expands */}
        <AnimatePresence>
          {!searchOpen && (
            <motion.div
              key="nav-links"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="hidden items-center gap-8 md:flex"
            >
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-text-muted transition-colors hover:text-primary"
                >
                  {link.label}
                </a>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* CTA + UserMenu — fade out when search expands */}
          <AnimatePresence>
            {!searchOpen && (
              <motion.div
                key="cta"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="hidden items-center gap-3 md:flex"
              >
                <a
                  href={cta.href}
                  className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-neutral hover:shadow-md active:scale-[0.97]"
                >
                  {cta.label}
                </a>
                <UserMenu variant="desktop" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* ExpandableSearch — only when onSearchChange is provided */}
          {onSearchChange !== undefined && search !== undefined && (
            <ExpandableSearch
              value={search}
              onChange={onSearchChange}
              onIsOpenChange={setSearchOpen}
            />
          )}

          {/* FilterTrigger — only when onFilterOpen is provided */}
          {onFilterOpen !== undefined && (
            <FilterTrigger count={activeFilterCount} onClick={onFilterOpen} />
          )}

          {/* Mobile hamburger — shown on pages without filter props */}
          {!hasFilterProps && (
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
                  <path
                    d="M4 6h14M4 11h14M4 16h14"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                )}
              </svg>
            </button>
          )}
        </div>
      </motion.div>

      {/* Mobile menu — only on pages without filter props */}
      {!hasFilterProps && mobileOpen && (
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
              <a
                href={cta.href}
                onClick={() => setMobileOpen(false)}
                className="block rounded-full bg-primary px-5 py-3 text-center text-sm font-semibold text-white shadow-sm transition-all hover:bg-neutral active:scale-[0.97]"
              >
                {cta.label}
              </a>
              <UserMenu variant="mobile" onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
