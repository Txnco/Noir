"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";

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

interface FilterDrawerProps {
  open: boolean;
  onClose: () => void;
  maxPrice: number;
  // Main state — desktop instant apply
  dateFilter: DateGroup | "all";
  onDateChange: (val: DateGroup | "all") => void;
  priceRange: PriceRange;
  onPriceRangeChange: (val: PriceRange) => void;
  distanceRadius: number | null;
  onDistanceChange: (val: number | null) => void;
  sortBy: SortOption;
  onSortChange: (val: SortOption) => void;
  // Draft state — mobile explicit apply
  draft: DraftFilters;
  onDraftChange: (partial: Partial<DraftFilters>) => void;
  onApply: () => void;
  draftResultCount: number;
  // Reset drawer filters (immediate, closes drawer)
  onReset: () => void;
  hasActiveDrawerFilters: boolean;
  // Location
  userLocation: UserLocation | null;
  onRequestLocation: () => void;
}

const DATE_OPTIONS: { id: DateGroup | "all"; label: string }[] = [
  { id: "all", label: "Bilo kada" },
  { id: "today", label: "Danas" },
  { id: "tomorrow", label: "Sutra" },
  { id: "weekend", label: "Vikend" },
  { id: "week", label: "Ovaj tjedan" },
];

const SORT_OPTIONS: { id: SortOption; label: string }[] = [
  { id: "date", label: "Datum" },
  { id: "price", label: "Cijena" },
];

const MAX_DISTANCE = 50; // km

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-text-muted">
      {children}
    </h3>
  );
}

function PillButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all",
        active
          ? "border-primary bg-primary text-white shadow-sm"
          : "border-border bg-surface-white text-text-muted hover:border-accent/40 hover:text-primary",
        disabled ? "pointer-events-none opacity-40" : "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function LocationIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export default function FilterDrawer({
  open,
  onClose,
  maxPrice,
  dateFilter,
  onDateChange,
  priceRange,
  onPriceRangeChange,
  distanceRadius,
  onDistanceChange,
  sortBy,
  onSortChange,
  draft,
  onDraftChange,
  onApply,
  draftResultCount,
  onReset,
  hasActiveDrawerFilters,
  userLocation,
  onRequestLocation,
}: FilterDrawerProps) {
  const isMobile = useMediaQuery("(max-width: 767px)");

  // Active values (desktop uses main state, mobile uses draft)
  const activeDateFilter = isMobile ? draft.dateFilter : dateFilter;
  const activePriceRange = isMobile ? draft.priceRange : priceRange;
  const activeDistance = isMobile ? draft.distanceRadius : distanceRadius;
  const activeSortBy = isMobile ? draft.sortBy : sortBy;
  const distanceValue = activeDistance ?? 0;

  function handleDate(val: DateGroup | "all") {
    if (isMobile) onDraftChange({ dateFilter: val });
    else onDateChange(val);
  }

  function handlePriceRange(val: number[]) {
    const range = val as PriceRange;
    if (isMobile) onDraftChange({ priceRange: range });
    else onPriceRangeChange(range);
  }

  function handleDistance(val: number[]) {
    const km = val[0] === 0 ? null : val[0];
    if (isMobile) onDraftChange({ distanceRadius: km });
    else onDistanceChange(km);
  }

  function handleSort(val: SortOption) {
    if (isMobile) onDraftChange({ sortBy: val });
    else onSortChange(val);
  }

  const priceLabel =
    activePriceRange[0] === 0 && activePriceRange[1] >= maxPrice
      ? "Sve"
      : activePriceRange[0] === 0
      ? `Do ${activePriceRange[1]}€`
      : `${activePriceRange[0]}€ – ${activePriceRange[1]}€`;

  const distanceLabel =
    distanceValue === 0 ? "Bez ograničenja" : `Do ${distanceValue} km`;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={
          isMobile
            ? "max-h-[75vh] overflow-y-auto rounded-t-2xl"
            : "w-[380px] flex flex-col"
        }
      >
        <SheetHeader className="px-4 pt-2">
          <SheetTitle className="font-display text-neutral">Filteri</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-2 mt-2">

          {/* ── Datum ── */}
          <section>
            <SectionLabel>Datum</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {DATE_OPTIONS.map((opt) => (
                <PillButton
                  key={opt.id}
                  active={activeDateFilter === opt.id}
                  onClick={() => handleDate(opt.id)}
                >
                  {opt.label}
                </PillButton>
              ))}
            </div>
          </section>

          {/* ── Cijena ── */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <SectionLabel>Cijena</SectionLabel>
              <span className="text-xs font-medium text-text-muted">{priceLabel}</span>
            </div>
            <div className="px-1">
              <Slider
                min={0}
                max={maxPrice}
                step={5}
                value={activePriceRange}
                onValueChange={handlePriceRange}
              />
              <div className="mt-2 flex justify-between text-[10px] text-text-muted">
                <span>0€</span>
                <span>{maxPrice}€</span>
              </div>
            </div>
          </section>

          {/* ── Distanca ── */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <SectionLabel>Distanca</SectionLabel>
              <span className="text-xs font-medium text-text-muted">{distanceLabel}</span>
            </div>
            {userLocation ? (
              <div className="px-1">
                <Slider
                  min={0}
                  max={MAX_DISTANCE}
                  step={1}
                  value={[distanceValue]}
                  onValueChange={handleDistance}
                />
                <div className="mt-2 flex justify-between text-[10px] text-text-muted">
                  <span>Svi</span>
                  <span>{MAX_DISTANCE} km</span>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-surface px-4 py-3 text-sm text-text-muted">
                <button
                  onClick={onRequestLocation}
                  className="flex items-center gap-2 font-medium transition-colors hover:text-primary"
                >
                  <LocationIcon />
                  Uključi lokaciju za filter po distanci
                </button>
              </div>
            )}
          </section>

          {/* ── Sortiranje ── */}
          <section>
            <SectionLabel>Sortiraj po</SectionLabel>
            <div className="flex gap-2">
              {SORT_OPTIONS.map((opt) => (
                <PillButton
                  key={opt.id}
                  active={activeSortBy === opt.id}
                  onClick={() => handleSort(opt.id)}
                >
                  {opt.label}
                </PillButton>
              ))}
            </div>
          </section>

        </div>

        {/* ── Footer ── */}
        <div className="mt-auto border-t border-border px-4 pb-4 pt-4">
          {isMobile ? (
            <div className="flex items-center gap-3">
              {hasActiveDrawerFilters && (
                <button
                  onClick={onReset}
                  className="text-sm font-medium text-text-muted transition-colors hover:text-primary"
                >
                  Obriši sve
                </button>
              )}
              <button
                onClick={onApply}
                className="ml-auto rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-neutral active:scale-[0.97]"
              >
                Primijeni · {draftResultCount}{" "}
                {draftResultCount === 1 ? "rezultat" : "rezultata"}
              </button>
            </div>
          ) : (
            hasActiveDrawerFilters && (
              <button
                onClick={onReset}
                className="text-sm font-medium text-text-muted transition-colors hover:text-primary"
              >
                Obriši sve
              </button>
            )
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
