"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Reveal from "@/components/Reveal";

// ═══════════════ TYPES ═══════════════

type CategoryId =
  | "all"
  | "techno"
  | "house"
  | "live"
  | "jazz"
  | "kviz"
  | "stand-up"
  | "party"
  | "hip-hop"
  | "dance"
  | "gastro";

type DateGroup = "today" | "tomorrow" | "weekend" | "week";

interface EventItem {
  id: number;
  name: string;
  venue: string;
  category: Exclude<CategoryId, "all">;
  categoryLabel: string;
  dateLabel: string;
  dateGroup: DateGroup;
  time: string;
  price: number;
  earlyBird?: { soldPct: number };
  tags: string[];
  gradient: string;
  attending: number;
}

// ═══════════════ DATA ═══════════════

const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: "all", label: "Sve" },
  { id: "techno", label: "Techno" },
  { id: "house", label: "House" },
  { id: "live", label: "Live" },
  { id: "jazz", label: "Jazz" },
  { id: "party", label: "Party" },
  { id: "hip-hop", label: "Hip Hop" },
  { id: "dance", label: "Dance" },
  { id: "kviz", label: "Kviz" },
  { id: "stand-up", label: "Stand-up" },
  { id: "gastro", label: "Gastro" },
];

const DATE_FILTERS: { id: DateGroup | "all"; label: string }[] = [
  { id: "all", label: "Bilo kada" },
  { id: "today", label: "Danas" },
  { id: "tomorrow", label: "Sutra" },
  { id: "weekend", label: "Vikend" },
  { id: "week", label: "Ovaj tjedan" },
];

const EVENTS: EventItem[] = [
  {
    id: 1,
    name: "Neon Nights",
    venue: "Club Boogaloo",
    category: "techno",
    categoryLabel: "Techno",
    dateLabel: "Danas, 23:00",
    dateGroup: "today",
    time: "23:00",
    price: 8,
    earlyBird: { soldPct: 82 },
    tags: ["techno", "club", "dj"],
    gradient: "linear-gradient(135deg, #1e1b4b 0%, #4338ca 50%, #7c3aed 100%)",
    attending: 234,
  },
  {
    id: 2,
    name: "Jazz & Wine večer",
    venue: "Vintage Industrial Bar",
    category: "jazz",
    categoryLabel: "Jazz",
    dateLabel: "Sutra, 20:00",
    dateGroup: "tomorrow",
    time: "20:00",
    price: 12,
    tags: ["jazz", "live", "wine"],
    gradient: "linear-gradient(135deg, #0c4a6e 0%, #075985 50%, #0e7490 100%)",
    attending: 87,
  },
  {
    id: 3,
    name: "Student Kviz Liga",
    venue: "Craft Room",
    category: "kviz",
    categoryLabel: "Kviz",
    dateLabel: "Danas, 19:30",
    dateGroup: "today",
    time: "19:30",
    price: 5,
    earlyBird: { soldPct: 64 },
    tags: ["kviz", "students"],
    gradient: "linear-gradient(135deg, #064e3b 0%, #047857 50%, #0d9488 100%)",
    attending: 156,
  },
  {
    id: 4,
    name: "Retro Disco Fever",
    venue: "Aquarius",
    category: "party",
    categoryLabel: "Party",
    dateLabel: "Pet, 22:00",
    dateGroup: "weekend",
    time: "22:00",
    price: 10,
    tags: ["disco", "retro", "party"],
    gradient: "linear-gradient(135deg, #831843 0%, #be185d 50%, #ec4899 100%)",
    attending: 412,
  },
  {
    id: 5,
    name: "Stand-up Komedija",
    venue: "KSET",
    category: "stand-up",
    categoryLabel: "Stand-up",
    dateLabel: "Pet, 20:00",
    dateGroup: "weekend",
    time: "20:00",
    price: 7,
    earlyBird: { soldPct: 91 },
    tags: ["komedija", "live"],
    gradient: "linear-gradient(135deg, #78350f 0%, #d97706 50%, #f59e0b 100%)",
    attending: 98,
  },
  {
    id: 6,
    name: "Salsa Night Latino",
    venue: "Club Boogaloo",
    category: "dance",
    categoryLabel: "Dance",
    dateLabel: "Sub, 21:00",
    dateGroup: "weekend",
    time: "21:00",
    price: 6,
    tags: ["salsa", "dance", "latino"],
    gradient: "linear-gradient(135deg, #7f1d1d 0%, #dc2626 50%, #f87171 100%)",
    attending: 178,
  },
  {
    id: 7,
    name: "Underground Techno",
    venue: "Culture Club Revelin",
    category: "techno",
    categoryLabel: "Techno",
    dateLabel: "Sub, 23:30",
    dateGroup: "weekend",
    time: "23:30",
    price: 15,
    earlyBird: { soldPct: 47 },
    tags: ["techno", "underground"],
    gradient: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)",
    attending: 521,
  },
  {
    id: 8,
    name: "Acoustic Sessions",
    venue: "Bacchus Jazz Bar",
    category: "live",
    categoryLabel: "Live",
    dateLabel: "Danas, 21:00",
    dateGroup: "today",
    time: "21:00",
    price: 0,
    tags: ["acoustic", "live", "free"],
    gradient: "linear-gradient(135deg, #422006 0%, #92400e 50%, #ea580c 100%)",
    attending: 64,
  },
  {
    id: 9,
    name: "Hip Hop Utorak",
    venue: "Masters Club",
    category: "hip-hop",
    categoryLabel: "Hip Hop",
    dateLabel: "Uto, 22:00",
    dateGroup: "week",
    time: "22:00",
    price: 5,
    tags: ["hiphop", "rap"],
    gradient: "linear-gradient(135deg, #18181b 0%, #3f3f46 50%, #71717a 100%)",
    attending: 142,
  },
  {
    id: 10,
    name: "Wine Tasting Experience",
    venue: "Esplanade Hotel",
    category: "gastro",
    categoryLabel: "Gastro",
    dateLabel: "Ned, 19:00",
    dateGroup: "weekend",
    time: "19:00",
    price: 25,
    earlyBird: { soldPct: 73 },
    tags: ["wine", "gastro"],
    gradient: "linear-gradient(135deg, #4c0519 0%, #881337 50%, #be123c 100%)",
    attending: 32,
  },
  {
    id: 11,
    name: "Karaoke Open Mic",
    venue: "Hard Place",
    category: "party",
    categoryLabel: "Party",
    dateLabel: "Sri, 21:00",
    dateGroup: "week",
    time: "21:00",
    price: 0,
    tags: ["karaoke", "free"],
    gradient: "linear-gradient(135deg, #4a044e 0%, #86198f 50%, #c026d3 100%)",
    attending: 89,
  },
  {
    id: 12,
    name: "Drum & Bass Attack",
    venue: "Club Boogaloo",
    category: "techno",
    categoryLabel: "Techno",
    dateLabel: "Pet, 23:00",
    dateGroup: "weekend",
    time: "23:00",
    price: 8,
    tags: ["dnb", "bass"],
    gradient: "linear-gradient(135deg, #042f2e 0%, #115e59 50%, #14b8a6 100%)",
    attending: 287,
  },
  {
    id: 13,
    name: "Indie Night Live",
    venue: "Močvara",
    category: "live",
    categoryLabel: "Live",
    dateLabel: "Sub, 21:30",
    dateGroup: "weekend",
    time: "21:30",
    price: 6,
    tags: ["indie", "live", "rock"],
    gradient: "linear-gradient(135deg, #1c1917 0%, #57534e 50%, #a8a29e 100%)",
    attending: 134,
  },
  {
    id: 14,
    name: "House Sessions",
    venue: "Sax! Club",
    category: "house",
    categoryLabel: "House",
    dateLabel: "Pet, 22:30",
    dateGroup: "weekend",
    time: "22:30",
    price: 7,
    tags: ["house", "deep"],
    gradient: "linear-gradient(135deg, #431407 0%, #9a3412 50%, #f97316 100%)",
    attending: 198,
  },
  {
    id: 15,
    name: "Latino Vibes Open",
    venue: "Taboo Club",
    category: "dance",
    categoryLabel: "Dance",
    dateLabel: "Sub, 22:00",
    dateGroup: "weekend",
    time: "22:00",
    price: 8,
    earlyBird: { soldPct: 55 },
    tags: ["latino", "dance"],
    gradient: "linear-gradient(135deg, #500724 0%, #9d174d 50%, #f43f5e 100%)",
    attending: 167,
  },
];

// ═══════════════ HELPERS ═══════════════

function priceLabel(price: number): string {
  return price === 0 ? "Besplatno" : `${price}€`;
}

function formatAttending(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ═══════════════ COMPONENTS ═══════════════

function CategoryIcon({ category }: { category: EventItem["category"] }) {
  // distinct minimal icon per category
  const icons: Record<EventItem["category"], React.ReactElement> = {
    techno: (
      <svg viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="3" fill="white" />
      </svg>
    ),
    house: (
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M4 12l8-7 8 7v8a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1v-8z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
    live: (
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M9 18V5l12-2v13" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="6" cy="18" r="3" stroke="white" strokeWidth="1.5" />
        <circle cx="18" cy="16" r="3" stroke="white" strokeWidth="1.5" />
      </svg>
    ),
    jazz: (
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M4 8c0-2 2-4 4-4s4 2 4 4v8c0 2-2 4-4 4s-4-2-4-4V8z" stroke="white" strokeWidth="1.5" />
        <path d="M16 4l4 2v8l-4-2V4z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
    kviz: (
      <svg viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="1.5" />
        <path d="M9 9a3 3 0 116 0c0 1.5-1.5 2-3 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="12" cy="17" r="0.5" fill="white" stroke="white" strokeWidth="1.5" />
      </svg>
    ),
    "stand-up": (
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M12 4v8M9 8h6" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        <rect x="6" y="12" width="12" height="8" rx="2" stroke="white" strokeWidth="1.5" />
      </svg>
    ),
    party: (
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M3 21l4-12 8 8-12 4z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M15 9l3-3M18 12l3-1M14 4l1 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    "hip-hop": (
      <svg viewBox="0 0 24 24" fill="none">
        <rect x="3" y="6" width="18" height="12" rx="2" stroke="white" strokeWidth="1.5" />
        <path d="M7 12h2M11 12h2M15 12h2" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    dance: (
      <svg viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="5" r="2" stroke="white" strokeWidth="1.5" />
        <path d="M12 7v6M9 13h6M9 13l-3 7M15 13l3 7" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    gastro: (
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M6 3v10a3 3 0 003 3v5M9 3v6M12 3v6M18 3c-1.5 0-3 2-3 5s1.5 5 3 5v8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  };

  return <div className="h-6 w-6">{icons[category]}</div>;
}

function EventCard({ event, index }: { event: EventItem; index: number }) {
  return (
    <a
      href={`/eventi/${event.id}`}
      className="animate-card-in group relative block overflow-hidden rounded-2xl border border-border bg-surface-white shadow-sm transition-all duration-500 hover:-translate-y-1 hover:border-accent/40 hover:shadow-2xl hover:shadow-primary/10"
      style={{ animationDelay: `${Math.min(index * 60, 600)}ms` }}
    >
      {/* gradient image area */}
      <div className="relative h-44 overflow-hidden">
        <div
          className="absolute inset-0 transition-transform duration-700 group-hover:scale-110"
          style={{ background: event.gradient }}
        />
        {/* subtle grain overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-30 mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />

        {/* category icon top-left */}
        <div className="absolute top-4 left-4 flex items-center gap-2 rounded-full bg-black/30 px-3 py-1.5 backdrop-blur-md">
          <CategoryIcon category={event.category} />
          <span className="text-xs font-semibold text-white">{event.categoryLabel}</span>
        </div>

        {/* price badge top-right */}
        <div className="absolute top-4 right-4 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-primary shadow-md backdrop-blur-md">
          {priceLabel(event.price)}
        </div>

        {/* early bird ribbon bottom */}
        {event.earlyBird && (
          <div className="absolute right-4 bottom-4 left-4">
            <div className="flex items-center justify-between text-[10px] font-medium text-white/90">
              <span className="rounded-full bg-accent/90 px-2 py-0.5 font-bold text-white">
                Early Bird
              </span>
              <span>{event.earlyBird.soldPct}% prodano</span>
            </div>
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-white"
                style={{ width: `${event.earlyBird.soldPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* content */}
      <div className="p-5">
        <h3 className="font-display text-lg font-bold leading-tight text-neutral transition-colors group-hover:text-primary">
          {event.name}
        </h3>

        <div className="mt-2 flex items-center gap-1.5 text-sm text-text-muted">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 14s5-4 5-8a5 5 0 00-10 0c0 4 5 8 5 8z"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <circle cx="8" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <span className="truncate">{event.venue}</span>
        </div>

        <div className="mt-1 flex items-center gap-1.5 text-sm text-text-muted">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 4v4l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>{event.dateLabel}</span>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" />
              <path d="M2 14c0-3 2.5-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span>
              <span className="font-semibold text-primary">{formatAttending(event.attending)}</span> idu
            </span>
          </div>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-primary transition-all group-hover:bg-primary group-hover:text-white">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M3 8h10M9 4l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
      </div>
    </a>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-surface-white/60 px-6 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <circle cx="14" cy="14" r="9" stroke="#7DB5C8" strokeWidth="2" />
          <path d="M21 21l6 6" stroke="#7DB5C8" strokeWidth="2" strokeLinecap="round" />
          <path d="M10 14h8M14 10v8" stroke="#7DB5C8" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="font-display mt-6 text-xl font-bold text-neutral">Nema rezultata</h3>
      <p className="mt-2 max-w-sm text-sm text-text-muted">
        Pokušaj s drugom pretragom ili promijeni filtere. Možda novi event čeka iza ugla.
      </p>
      <button
        onClick={onReset}
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-neutral active:scale-[0.97]"
      >
        Resetiraj filtere
      </button>
    </div>
  );
}

// ═══════════════ PAGE ═══════════════

export default function EventiPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryId>("all");
  const [dateFilter, setDateFilter] = useState<DateGroup | "all">("all");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K to focus search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape" && document.activeElement === searchRef.current) {
        searchRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return EVENTS.filter((e) => {
      if (category !== "all" && e.category !== category) return false;
      if (dateFilter !== "all" && e.dateGroup !== dateFilter) return false;
      if (q) {
        const haystack = `${e.name} ${e.venue} ${e.categoryLabel} ${e.tags.join(" ")}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [search, category, dateFilter]);

  const resetFilters = () => {
    setSearch("");
    setCategory("all");
    setDateFilter("all");
    searchRef.current?.focus();
  };

  const hasActiveFilters = search !== "" || category !== "all" || dateFilter !== "all";

  return (
    <div className="noise-bg relative min-h-screen">
      <Navbar cta={{ label: "Postani organizator", href: "/#kontakt" }}>
        {/* Filter pills — rendered inside the navbar so the entire header
            shares ONE backdrop-filter (no seam between two glass layers) */}
        <div className="border-b border-border">
          <div className="mx-auto max-w-6xl px-6 pt-1 pb-4">
            {/* Category pills - horizontal scroll on mobile */}
            <div className="scrollbar-hide -mx-6 flex gap-2 overflow-x-auto px-6 pb-1">
              {CATEGORIES.map((cat) => {
                const active = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setCategory(cat.id)}
                    className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-all ${
                      active
                        ? "border-primary bg-primary text-white shadow-md shadow-primary/20"
                        : "border-border bg-surface-white text-text-muted hover:border-accent/40 hover:text-primary"
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {/* Date tabs */}
            <div className="scrollbar-hide -mx-6 mt-3 flex gap-2 overflow-x-auto px-6">
              {DATE_FILTERS.map((d) => {
                const active = dateFilter === d.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => setDateFilter(d.id)}
                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                      active
                        ? "bg-accent/15 text-primary"
                        : "text-text-muted hover:bg-surface-white hover:text-primary"
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Navbar>

      {/* ═══════════ HERO + SEARCH ═══════════ */}
      <section className="relative overflow-hidden pt-52 pb-12 md:pt-60 md:pb-16">
        {/* decorative blobs */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-[420px] w-[420px] rounded-full bg-accent/10 blur-3xl" />
        <div className="pointer-events-none absolute -top-32 -left-40 h-[360px] w-[360px] rounded-full bg-secondary/10 blur-3xl" />

        <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
          <Reveal variant="fade-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-white/70 px-4 py-1.5 text-xs font-medium text-text-muted backdrop-blur">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              {EVENTS.length} aktivnih evenata u Zagrebu
            </div>
          </Reveal>

          <Reveal variant="fade-up" delay={100}>
            <h1 className="font-display mt-6 text-[2.25rem] leading-[1.1] font-extrabold tracking-tight text-neutral md:text-5xl">
              Pronađi svoj
              <br />
              <span className="text-secondary">savršen izlazak</span>
            </h1>
          </Reveal>

          <Reveal variant="fade-up" delay={200}>
            <p className="mx-auto mt-4 max-w-md text-base text-text-muted md:text-lg">
              Pretraži po imenu, prostoru ili tagu. Filtriraj po kategoriji i datumu.
            </p>
          </Reveal>

          {/* Search bar */}
          <Reveal variant="fade-up" delay={300}>
            <div className="mx-auto mt-10 max-w-2xl">
              <div
                className={`relative flex items-center gap-3 rounded-2xl border bg-surface-white px-5 py-2 shadow-lg transition-all duration-300 ${
                  searchFocused
                    ? "border-accent shadow-xl shadow-accent/10 ring-4 ring-accent/10"
                    : "border-border shadow-primary/5"
                }`}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="shrink-0 text-text-muted">
                  <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M14 14l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  placeholder="Pretraži evente, prostore, tagove..."
                  className="flex-1 bg-transparent py-3 text-base text-neutral placeholder:text-text-muted focus:outline-none"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface text-text-muted transition-all hover:bg-border hover:text-primary"
                    aria-label="Obriši pretragu"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
                <kbd className="hidden shrink-0 rounded-md border border-border bg-surface px-2 py-1 text-[10px] font-semibold text-text-muted md:inline-block">
                  ⌘K
                </kbd>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════ RESULTS ═══════════ */}
      <section className="py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-6">
          {/* Result meta bar */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-bold text-neutral md:text-2xl">
                {filteredEvents.length === EVENTS.length
                  ? "Svi eventi"
                  : `${filteredEvents.length} ${filteredEvents.length === 1 ? "rezultat" : filteredEvents.length < 5 ? "rezultata" : "rezultata"}`}
              </h2>
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-accent transition-colors hover:text-primary"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  Obriši filtere
                </button>
              )}
            </div>
          </div>

          {/* Grid */}
          {filteredEvents.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredEvents.map((event, i) => (
                <EventCard key={event.id} event={event} index={i} />
              ))}
            </div>
          ) : (
            <EmptyState onReset={resetFilters} />
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
