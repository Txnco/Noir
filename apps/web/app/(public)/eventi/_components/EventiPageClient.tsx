"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, MapPin } from "lucide-react";
import { haversineDistanceKm, formatDistance } from "@/lib/utils";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Reveal from "@/components/Reveal";
import CheckoutModal from "@/components/CheckoutModal";
import type { EventDiscoveryOut } from "@/lib/typescript/api-types";

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

interface ProcessedEvent extends EventDiscoveryOut {
  _gradient: string;
  _dateGroup: DateGroup;
  _dateLabel: string;
  _lat: number;
  _lng: number;
}

// ═══════════════ CONSTANTS ═══════════════

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

// Mock Zagreb venue coordinates — replaced when API exposes real lat/lng
const MOCK_VENUE_COORDS = [
  { lat: 45.8128, lng: 15.9641 }, // Tvornica kulture
  { lat: 45.7886, lng: 15.9268 }, // Jarun / Aquarius
  { lat: 45.8162, lng: 15.9726 }, // Tkalčićeva
  { lat: 45.8008, lng: 15.9697 }, // KSET
  { lat: 45.8189, lng: 15.9748 }, // Boogaloo
  { lat: 45.8225, lng: 15.9511 }, // Lauba
];

const LOC_KEY = "noir_user_loc";

const GRADIENTS = [
  "linear-gradient(135deg, #1e1b4b 0%, #4338ca 50%, #7c3aed 100%)",
  "linear-gradient(135deg, #0c4a6e 0%, #075985 50%, #0e7490 100%)",
  "linear-gradient(135deg, #064e3b 0%, #047857 50%, #0d9488 100%)",
  "linear-gradient(135deg, #831843 0%, #be185d 50%, #ec4899 100%)",
];

// ═══════════════ HELPERS ═══════════════

function getDateGroup(isoString: string): DateGroup {
  const date = new Date(isoString.replace(" ", "T"));
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (date.toDateString() === today.toDateString()) return "today";
  if (date.toDateString() === tomorrow.toDateString()) return "tomorrow";
  if ([5, 6, 0].includes(date.getDay())) return "weekend";
  return "week";
}

function formatDateShort(isoString: string): string {
  if (!isoString) return "";
  const [datePart, timePart] = isoString.replace("T", " ").split(" ");
  if (!datePart || !timePart) return "";
  const [yr, mo, dy] = datePart.split("-").map(Number);
  const [hr, mn] = timePart.split(":").map(Number);
  if ([yr, mo, dy, hr, mn].some(isNaN)) return "";
  const date = new Date(yr, mo - 1, dy, hr, mn);
  const day = date.toLocaleDateString("hr-HR", { weekday: "short" });
  const time = `${String(hr).padStart(2, "0")}:${String(mn).padStart(2, "0")}`;
  return `${day.charAt(0).toUpperCase() + day.slice(1)}, ${time}`;
}

function priceLabel(event: EventDiscoveryOut): string {
  if (event.is_free || !event.min_price || event.min_price === 0) return "Besplatno";
  return `${event.min_price}€`;
}

// ═══════════════ COMPONENTS ═══════════════

function CategoryIcon({ category }: { category: CategoryId }) {
  const icons: Partial<Record<CategoryId, React.ReactElement>> = {
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
    gastro: (
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M6 3v10a3 3 0 003 3v5M9 3v6M12 3v6M18 3c-1.5 0-3 2-3 5s1.5 5 3 5v8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  };
  const icon = icons[category];
  if (!icon) return null;
  return <div className="h-5 w-5">{icon}</div>;
}

function EventCard({
  event,
  index,
  onPurchase,
  userLocation,
}: {
  event: ProcessedEvent;
  index: number;
  onPurchase: (event: ProcessedEvent) => void;
  userLocation: { lat: number; lng: number } | null;
}) {
  const [liked, setLiked] = useState(false);
  const price = priceLabel(event);
  const distance =
    userLocation != null
      ? haversineDistanceKm(userLocation.lat, userLocation.lng, event._lat, event._lng)
      : null;

  return (
    <div
      className="animate-card-in group relative overflow-hidden rounded-2xl border border-border bg-surface-white shadow-sm transition-all duration-500 hover:-translate-y-1 hover:border-accent/40 hover:shadow-2xl hover:shadow-primary/10"
      style={{ animationDelay: `${Math.min(index * 60, 600)}ms` }}
    >
      {/* Card body navigates to event detail (intercepting route shows Dialog) */}
      <Link href={`/eventi/${event.slug}`} className="block">
        {/* Portrait image area */}
        <div className="relative aspect-[3/4] overflow-hidden bg-[#2C3840]">
          {event.cover_image_url ? (
            <Image
              src={event.cover_image_url}
              alt={event.name}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-110"
            />
          ) : (
            <div
              className="absolute inset-0 transition-transform duration-700 group-hover:scale-110"
              style={{ background: event._gradient }}
            />
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#2C3840]/90 to-transparent" />

          {/* Grain overlay */}
          <div
            className="pointer-events-none absolute inset-0 opacity-20 mix-blend-overlay"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
            }}
          />

          {/* Category badge top-left */}
          <div className="absolute top-4 left-4 flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1.5 backdrop-blur-md">
            <CategoryIcon category="party" />
            <span className="text-xs font-semibold text-white">Event</span>
          </div>

          {/* Heart / Like button top-right — stops propagation so Link doesn't navigate */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setLiked((prev) => !prev);
            }}
            aria-label={liked ? "Ukloni iz favorita" : "Dodaj u favorite"}
            className="absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/30 backdrop-blur-md transition-all hover:bg-black/50 active:scale-90"
          >
            <Heart
              size={16}
              className={
                liked
                  ? "fill-rose-400 text-rose-400"
                  : "fill-transparent text-white"
              }
            />
          </button>

          {/* Event info over gradient at bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <h3 className="font-display text-lg font-bold leading-tight text-white drop-shadow-sm transition-colors group-hover:text-accent">
              {event.name}
            </h3>
            {event.venue_name && (
              <div className="mt-1.5 flex items-center gap-1.5 text-sm text-white/80">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path d="M8 14s5-4 5-8a5 5 0 00-10 0c0 4 5 8 5 8z" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="8" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                <span className="truncate">
                  {event.venue_name}
                  {distance != null && (
                    <span className="text-white/55">, {formatDistance(distance)}</span>
                  )}
                </span>
              </div>
            )}
            {event._dateLabel && (
              <div className="mt-1 flex items-center gap-1.5 text-sm text-white/70">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M8 4v4l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span>{event._dateLabel}</span>
              </div>
            )}
          </div>
        </div>
      </Link>

      {/* Footer: price + CTA — outside Link so clicks don't trigger navigation */}
      <div className="flex items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Cijena:</p>
          <p className="font-display text-base font-bold text-neutral">{price}</p>
        </div>
        <button
          onClick={() => onPurchase(event)}
          className="shrink-0 rounded-xl bg-neutral px-5 py-3 text-xs font-bold uppercase tracking-widest text-white transition-all hover:bg-primary hover:shadow-lg hover:shadow-primary/20 active:scale-[0.98]"
        >
          {event.is_free || !event.min_price || event.min_price === 0
            ? "Rezerviraj"
            : "Kupi kartu"}
        </button>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface-white">
      <div className="aspect-[3/4] animate-pulse bg-surface" />
      <div className="p-4">
        <div className="h-10 animate-pulse rounded-xl bg-surface" />
      </div>
    </div>
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

// ═══════════════ MAIN CLIENT COMPONENT ═══════════════

export default function EventiPageClient({ events }: { events: EventDiscoveryOut[] }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryId>("all");
  const [dateFilter, setDateFilter] = useState<DateGroup | "all">("all");
  const [searchFocused, setSearchFocused] = useState(false);
  const [checkoutEvent, setCheckoutEvent] = useState<ProcessedEvent | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOC_KEY);
      if (stored) setUserLocation(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  function requestLocation() {
    navigator.geolocation.getCurrentPosition((pos) => {
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setUserLocation(loc);
      localStorage.setItem(LOC_KEY, JSON.stringify(loc));
    });
  }

  // Process raw API events into UI-ready events (memoised so it runs once)
  const processedEvents = useMemo<ProcessedEvent[]>(
    () =>
      events.map((ev, i) => ({
        ...ev,
        _gradient: GRADIENTS[i % GRADIENTS.length],
        _dateGroup: ev.occurrence_date ? getDateGroup(ev.occurrence_date) : "week",
        _dateLabel: ev.occurrence_date ? formatDateShort(ev.occurrence_date) : "",
        _lat: MOCK_VENUE_COORDS[i % MOCK_VENUE_COORDS.length].lat,
        _lng: MOCK_VENUE_COORDS[i % MOCK_VENUE_COORDS.length].lng,
      })),
    [events],
  );

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return processedEvents.filter((e) => {
      if (dateFilter !== "all" && e._dateGroup !== dateFilter) return false;
      if (q) {
        const haystack =
          `${e.name} ${e.venue_name ?? ""} ${(e.tags ?? []).join(" ")}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [search, category, dateFilter, processedEvents]);

  const resetFilters = () => {
    setSearch("");
    setCategory("all");
    setDateFilter("all");
    searchRef.current?.focus();
  };

  const hasActiveFilters = search !== "" || category !== "all" || dateFilter !== "all";

  // ⌘K / Ctrl+K focusses the search bar
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

  return (
    <div className="noise-bg relative min-h-screen">
      {/* ═══ NAVBAR + FILTER PILLS ═══ */}
      <Navbar cta={{ label: "Postani organizator", href: "/#kontakt" }}>
        <div className="border-b border-border">
          <div className="mx-auto max-w-6xl px-6 pt-1 pb-4">
            {/* Category pills */}
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

      {/* ═══ HERO + SEARCH ═══ */}
      <section className="relative overflow-hidden pt-52 pb-12 md:pt-60 md:pb-16">
        <div className="pointer-events-none absolute -top-24 -right-24 h-[420px] w-[420px] rounded-full bg-accent/10 blur-3xl" />
        <div className="pointer-events-none absolute -top-32 -left-40 h-[360px] w-[360px] rounded-full bg-secondary/10 blur-3xl" />

        <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
          <Reveal variant="fade-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-white/70 px-4 py-1.5 text-xs font-medium text-text-muted backdrop-blur">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              {events.length} aktivnih evenata u Zagrebu
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

      {/* ═══ RESULTS GRID ═══ */}
      <section className="py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-8 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-bold text-neutral md:text-2xl">
                {filteredEvents.length === processedEvents.length
                  ? "Svi eventi"
                  : `${filteredEvents.length} ${filteredEvents.length === 1 ? "rezultat" : "rezultata"}`}
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

            {/* Soft opt-in lokacija — ne traži automatski, čeka klik */}
            <button
              onClick={requestLocation}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition-all ${
                userLocation
                  ? "border-accent/40 bg-accent/10 text-primary"
                  : "border-border bg-surface-white text-text-muted hover:border-accent/40 hover:text-primary"
              }`}
            >
              <MapPin size={13} className={userLocation ? "fill-accent/30" : ""} />
              {userLocation ? "Lokacija aktivna" : "Koristi moju lokaciju"}
            </button>
          </div>

          {filteredEvents.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredEvents.map((event, i) => (
                <EventCard
                  key={event.id}
                  event={event}
                  index={i}
                  onPurchase={setCheckoutEvent}
                  userLocation={userLocation}
                />
              ))}
            </div>
          ) : hasActiveFilters ? (
            <EmptyState onReset={resetFilters} />
          ) : (
            /* API returned no events — show subtle skeletons as placeholder */
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />

      {/* Checkout modal — triggered from EventCard "Kupi kartu" button */}
      {checkoutEvent && (
        <CheckoutModal
          isOpen={true}
          onClose={() => setCheckoutEvent(null)}
          event={{
            id: checkoutEvent.id,
            name: checkoutEvent.name,
            price: checkoutEvent.min_price ?? 0,
          }}
        />
      )}
    </div>
  );
}
