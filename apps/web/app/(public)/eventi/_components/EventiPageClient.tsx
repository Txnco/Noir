"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, X } from "lucide-react";
import { haversineDistanceKm, formatDistance, slugHash } from "@/lib/utils";
import Navbar from "@/components/Navbar";
import FilterDrawer from "@/components/FilterDrawer";
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
type SortOption = "date" | "price";
type PriceRange = [number, number];

interface DraftFilters {
  dateFilter: DateGroup | "all";
  priceRange: PriceRange;
  distanceRadius: number | null;
  sortBy: SortOption;
}

interface UserLocation {
  lat: number;
  lng: number;
}

interface ProcessedEvent extends EventDiscoveryOut {
  _gradient: string;
  _dateGroup: DateGroup;
  _dateLabel: string;
  _lat: number;
  _lng: number;
}

interface FilterConfig {
  search: string;
  category: CategoryId;
  dateFilter: DateGroup | "all";
  priceRange: PriceRange;
  distanceRadius: number | null;
  userLocation: UserLocation | null;
  maxPrice: number;
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

const DATE_LABELS: Record<DateGroup, string> = {
  today: "Danas",
  tomorrow: "Sutra",
  weekend: "Vikend",
  week: "Ovaj tjedan",
};

const MOCK_VENUE_COORDS = [
  { lat: 45.8128, lng: 15.9641 },
  { lat: 45.7886, lng: 15.9268 },
  { lat: 45.8162, lng: 15.9726 },
  { lat: 45.8008, lng: 15.9697 },
  { lat: 45.8189, lng: 15.9748 },
  { lat: 45.8225, lng: 15.9511 },
];

const LOC_KEY = "noir_user_loc";
const MAX_PRICE = 300; // price slider upper bound (€)
const MAX_DISTANCE = 50; // distance slider upper bound (km)

const GRADIENTS = [
  "linear-gradient(135deg, #1e1b4b 0%, #4338ca 50%, #7c3aed 100%)",
  "linear-gradient(135deg, #0c4a6e 0%, #075985 50%, #0e7490 100%)",
  "linear-gradient(135deg, #064e3b 0%, #047857 50%, #0d9488 100%)",
  "linear-gradient(135deg, #831843 0%, #be185d 50%, #ec4899 100%)",
];

// ═══════════════ FILTER FUNCTION (pure, outside component) ═══════════════

function applyFilters(events: ProcessedEvent[], config: FilterConfig): ProcessedEvent[] {
  const q = config.search.trim().toLowerCase();
  const normalize = (s: string) => s.toLowerCase().replace(/[-\s]+/g, " ").trim();

  return events.filter((e) => {
    if (config.category !== "all") {
      const tags = (e.tags ?? []).map(normalize);
      if (!tags.includes(normalize(config.category))) return false;
    }

    if (config.dateFilter !== "all" && e._dateGroup !== config.dateFilter) return false;

    // Price range — only filter when user moved handles away from defaults
    const eventPrice = e.min_price ?? 0;
    if (config.priceRange[0] > 0 && eventPrice < config.priceRange[0]) return false;
    if (config.priceRange[1] < config.maxPrice && eventPrice > config.priceRange[1]) return false;

    // Distance radius filter
    if (config.distanceRadius !== null && config.userLocation) {
      const dist = haversineDistanceKm(
        config.userLocation.lat, config.userLocation.lng,
        e._lat, e._lng,
      );
      if (dist > config.distanceRadius) return false;
    }

    if (q) {
      const haystack =
        `${e.name} ${e.venue_name ?? ""} ${(e.tags ?? []).join(" ")}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });
}

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

// category accepts string — no CategoryId cast needed
function CategoryIcon({ category }: { category: string }) {
  const icons: Record<string, React.ReactElement> = {
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

function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-white px-3 py-1 text-xs font-medium text-neutral">
      {label}
      <button
        onClick={onRemove}
        aria-label={`Ukloni filter: ${label}`}
        className="transition-colors hover:text-primary"
      >
        <X size={10} />
      </button>
    </span>
  );
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
  userLocation: UserLocation | null;
}) {
  const [liked, setLiked] = useState(false);
  const price = priceLabel(event);
  const distance =
    userLocation != null
      ? haversineDistanceKm(userLocation.lat, userLocation.lng, event._lat, event._lng)
      : null;

  const primaryTag = event.tags?.[0] ?? "event";

  return (
    <div
      className="animate-card-in group relative overflow-hidden rounded-2xl border border-border bg-surface-white shadow-sm transition-all duration-500 hover:-translate-y-1 hover:border-accent/40 hover:shadow-2xl hover:shadow-primary/10"
      style={{ animationDelay: `${Math.min(index * 60, 600)}ms` }}
    >
      <Link href={`/eventi/${event.slug}`} className="block">
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

          <div className="absolute inset-0 bg-gradient-to-t from-[#2C3840]/90 to-transparent" />

          <div
            className="pointer-events-none absolute inset-0 opacity-20 mix-blend-overlay"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
            }}
          />

          <div className="absolute top-4 left-4 flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1.5 backdrop-blur-md">
            <CategoryIcon category={primaryTag} />
            <span className="text-xs font-semibold capitalize text-white">
              {primaryTag.replace(/-/g, " ")}
            </span>
          </div>

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
              className={liked ? "fill-rose-400 text-rose-400" : "fill-transparent text-white"}
            />
          </button>

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

      <div className="flex items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Cijena:</p>
          <p className="font-display text-base font-bold text-neutral">{price}</p>
        </div>
        <button
          onClick={() => onPurchase(event)}
          className="shrink-0 rounded-xl bg-neutral px-5 py-3 text-xs font-bold uppercase tracking-widest text-white transition-all hover:bg-primary hover:shadow-lg hover:shadow-primary/20 active:scale-[0.98]"
        >
          {event.is_free || !event.min_price || event.min_price === 0 ? "Rezerviraj" : "Kupi kartu"}
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
  // ── Search ────────────────────────────────────────────────────
  const [search, setSearch] = useState("");

  // ── Fast filter: category only ────────────────────────────────
  const [category, setCategory] = useState<CategoryId>("all");

  // ── Drawer main state (instant on desktop) ────────────────────
  const [dateFilter, setDateFilter] = useState<DateGroup | "all">("all");
  const [priceRange, setPriceRange] = useState<PriceRange>([0, MAX_PRICE]);
  const [distanceRadius, setDistanceRadius] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("date");

  // ── Draft state (mobile drawer pending) ───────────────────────
  const [draft, setDraft] = useState<DraftFilters>({
    dateFilter: "all",
    priceRange: [0, MAX_PRICE],
    distanceRadius: null,
    sortBy: "date",
  });

  // ── UI state ──────────────────────────────────────────────────
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [checkoutEvent, setCheckoutEvent] = useState<ProcessedEvent | null>(null);

  // ── Load saved location ───────────────────────────────────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOC_KEY);
      if (stored) setUserLocation(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  // ── Processed events (slug-hash based, stable) ────────────────
  const processedEvents = useMemo<ProcessedEvent[]>(
    () =>
      events.map((ev) => ({
        ...ev,
        _gradient: GRADIENTS[slugHash(ev.slug, GRADIENTS.length)],
        _dateGroup: ev.occurrence_date ? getDateGroup(ev.occurrence_date) : "week",
        _dateLabel: ev.occurrence_date ? formatDateShort(ev.occurrence_date) : "",
        _lat: MOCK_VENUE_COORDS[slugHash(ev.slug, MOCK_VENUE_COORDS.length)].lat,
        _lng: MOCK_VENUE_COORDS[slugHash(ev.slug, MOCK_VENUE_COORDS.length)].lng,
      })),
    [events],
  );

  // ── Filtered events ───────────────────────────────────────────
  const filteredEvents = useMemo(
    () =>
      applyFilters(processedEvents, {
        search,
        category,
        dateFilter,
        priceRange,
        distanceRadius,
        userLocation,
        maxPrice: MAX_PRICE,
      }),
    [processedEvents, search, category, dateFilter, priceRange, distanceRadius, userLocation],
  );

  // ── Draft result count (for mobile "Primijeni · X") ───────────
  const draftResultCount = useMemo(
    () =>
      applyFilters(processedEvents, {
        search,
        category,
        dateFilter: draft.dateFilter,
        priceRange: draft.priceRange,
        distanceRadius: draft.distanceRadius,
        userLocation,
        maxPrice: MAX_PRICE,
      }).length,
    [processedEvents, search, category, draft, userLocation],
  );

  // ── Sorted events ⚠️ grid renders this, NOT filteredEvents ────
  const sortedEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => {
      if (sortBy === "date")
        return (a.occurrence_date ?? "").localeCompare(b.occurrence_date ?? "");
      if (sortBy === "price")
        return (a.min_price ?? 0) - (b.min_price ?? 0);
      return 0;
    });
  }, [filteredEvents, sortBy]);

  // ── Computed ──────────────────────────────────────────────────

  const priceActive = priceRange[0] > 0 || priceRange[1] < MAX_PRICE;

  // Badge counts only restrictive drawer filters (sortBy excluded)
  const activeFilterCount = [
    dateFilter !== "all",
    priceActive,
    distanceRadius !== null,
  ].filter(Boolean).length;

  const hasActiveFilters =
    search !== "" ||
    category !== "all" ||
    dateFilter !== "all" ||
    priceActive ||
    distanceRadius !== null;

  const hasActiveDrawerFilters =
    dateFilter !== "all" ||
    priceActive ||
    distanceRadius !== null ||
    sortBy !== "date";

  // ── Handlers ──────────────────────────────────────────────────

  function openDrawer() {
    setDraft({ dateFilter, priceRange, distanceRadius, sortBy });
    setFilterDrawerOpen(true);
  }

  function applyDraft() {
    setDateFilter(draft.dateFilter);
    setPriceRange(draft.priceRange);
    setDistanceRadius(draft.distanceRadius);
    setSortBy(draft.sortBy);
    setFilterDrawerOpen(false);
  }

  function handleDraftChange(partial: Partial<DraftFilters>) {
    setDraft((prev) => ({ ...prev, ...partial }));
  }

  function resetDrawerFilters() {
    const defaults: DraftFilters = {
      dateFilter: "all",
      priceRange: [0, MAX_PRICE],
      distanceRadius: null,
      sortBy: "date",
    };
    setDateFilter("all");
    setPriceRange([0, MAX_PRICE]);
    setDistanceRadius(null);
    setSortBy("date");
    setDraft(defaults);
    setFilterDrawerOpen(false);
  }

  function resetFilters() {
    setSearch("");
    setCategory("all");
    setDateFilter("all");
    setPriceRange([0, MAX_PRICE]);
    setDistanceRadius(null);
    setSortBy("date");
    setDraft({ dateFilter: "all", priceRange: [0, MAX_PRICE], distanceRadius: null, sortBy: "date" });
  }

  function requestLocation() {
    navigator.geolocation.getCurrentPosition((pos) => {
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setUserLocation(loc);
      localStorage.setItem(LOC_KEY, JSON.stringify(loc));
    });
  }

  // ── Pill styles ───────────────────────────────────────────────
  const activePill =
    "rounded-full border border-primary bg-primary text-white text-sm font-semibold transition-all px-4 py-2";
  const inactivePill =
    "rounded-full border border-border bg-surface-white text-text-muted hover:border-accent/40 hover:text-primary text-sm transition-all px-4 py-2";

  // ── Active chip labels ────────────────────────────────────────
  const priceLabelChip =
    priceRange[0] === 0
      ? `Do ${priceRange[1]}€`
      : `${priceRange[0]}€ – ${priceRange[1]}€`;

  return (
    <div className="noise-bg relative min-h-screen">
      {/* ═══ NAVBAR ═══ */}
      <Navbar
        cta={{ label: "Postani organizator", href: "/#kontakt" }}
        search={search}
        onSearchChange={setSearch}
        activeFilterCount={activeFilterCount}
        onFilterOpen={openDrawer}
      />

      {/* ═══ FAST FILTER STRIP — category only, static, scrolls away ═══ */}
      <div className="pt-20">
        <div className="border-b border-border bg-surface">
          <div className="mx-auto max-w-6xl px-6 pt-3 pb-4">
            {/* Category pills — flex-wrap so all are reachable on any screen */}
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={category === cat.id ? activePill : inactivePill}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Active filter chips — conditional */}
        {hasActiveFilters && (
          <div className="mx-auto max-w-6xl flex flex-wrap items-center gap-2 px-6 py-2">
            {category !== "all" && (
              <ActiveChip
                label={CATEGORIES.find((c) => c.id === category)?.label ?? category}
                onRemove={() => setCategory("all")}
              />
            )}
            {dateFilter !== "all" && (
              <ActiveChip
                label={DATE_LABELS[dateFilter]}
                onRemove={() => setDateFilter("all")}
              />
            )}
            {priceActive && (
              <ActiveChip
                label={priceLabelChip}
                onRemove={() => setPriceRange([0, MAX_PRICE])}
              />
            )}
            {distanceRadius !== null && (
              <ActiveChip
                label={`Do ${distanceRadius} km`}
                onRemove={() => setDistanceRadius(null)}
              />
            )}
            {search && (
              <ActiveChip label={`"${search}"`} onRemove={() => setSearch("")} />
            )}
            <button
              onClick={resetFilters}
              className="text-xs font-medium text-accent transition-colors hover:text-primary"
            >
              Obriši sve
            </button>
          </div>
        )}
      </div>

      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden pt-32 pb-6 md:pt-36 md:pb-8">
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
              Pretraži, filtriraj, izađi.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ═══ RESULTS GRID ═══ */}
      <section className="py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-8">
            <h2 className="font-display text-xl font-bold text-neutral md:text-2xl">
              {filteredEvents.length === processedEvents.length
                ? "Svi eventi"
                : `${filteredEvents.length} ${filteredEvents.length === 1 ? "rezultat" : "rezultata"}`}
            </h2>
          </div>

          {/* ⚠️ Grid renders sortedEvents — NOT filteredEvents */}
          {sortedEvents.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {sortedEvents.map((event, i) => (
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
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />

      {/* ═══ FILTER DRAWER ═══ */}
      <FilterDrawer
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        maxPrice={MAX_PRICE}
        dateFilter={dateFilter}
        onDateChange={setDateFilter}
        priceRange={priceRange}
        onPriceRangeChange={setPriceRange}
        distanceRadius={distanceRadius}
        onDistanceChange={setDistanceRadius}
        sortBy={sortBy}
        onSortChange={setSortBy}
        draft={draft}
        onDraftChange={handleDraftChange}
        onApply={applyDraft}
        draftResultCount={draftResultCount}
        onReset={resetDrawerFilters}
        hasActiveDrawerFilters={hasActiveDrawerFilters}
        userLocation={userLocation}
        onRequestLocation={requestLocation}
      />

      {/* ═══ CHECKOUT MODAL ═══ */}
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
