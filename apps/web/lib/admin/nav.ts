import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  Building2,
  MapPin,
  CalendarDays,
  ShoppingCart,
  Receipt,
  MessagesSquare,
  ScrollText,
  Tags,
} from "lucide-react";

export interface AdminNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  soon?: boolean;
}

export interface AdminNavSection {
  label: string;
  items: AdminNavItem[];
}

export const adminNav: AdminNavSection[] = [
  {
    label: "Platforma",
    items: [
      { label: "Pregled", href: "/admin", icon: LayoutDashboard },
      { label: "Korisnici", href: "/admin/korisnici", icon: Users },
      { label: "Organizacije", href: "/admin/organizacije", icon: Building2 },
      { label: "Prostori", href: "/admin/prostori", icon: MapPin },
      { label: "Eventi", href: "/admin/eventi", icon: CalendarDays },
    ],
  },
  {
    label: "Uskoro",
    items: [
      { label: "Narudžbe", href: "/admin/narudzbe", icon: ShoppingCart, soon: true },
      { label: "Transakcije", href: "/admin/transakcije", icon: Receipt, soon: true },
      { label: "Upiti", href: "/admin/upiti", icon: MessagesSquare, soon: true },
      { label: "Revizija", href: "/admin/revizija", icon: ScrollText, soon: true },
      { label: "Oznake", href: "/admin/oznake", icon: Tags, soon: true },
    ],
  },
];

/** Flat lookup of label by pathname, for breadcrumb/header titles. */
export function adminTitleFor(pathname: string): string {
  for (const section of adminNav) {
    for (const item of section.items) {
      if (item.href === pathname) return item.label;
    }
  }
  if (pathname.startsWith("/admin/korisnici")) return "Korisnici";
  if (pathname.startsWith("/admin/organizacije")) return "Organizacije";
  if (pathname.startsWith("/admin/prostori")) return "Prostori";
  if (pathname.startsWith("/admin/eventi")) return "Eventi";
  return "Pregled";
}
