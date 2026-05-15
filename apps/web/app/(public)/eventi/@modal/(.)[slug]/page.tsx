"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import CheckoutModal from "@/components/CheckoutModal";
import type { EventDiscoveryOut } from "@/lib/typescript/api-types";
import { haversineDistanceKm, formatDistance } from "@/lib/utils";

const MOCK_VENUE_COORDS = [
  { lat: 45.8128, lng: 15.9641 },
  { lat: 45.7886, lng: 15.9268 },
  { lat: 45.8162, lng: 15.9726 },
  { lat: 45.8008, lng: 15.9697 },
  { lat: 45.8189, lng: 15.9748 },
  { lat: 45.8225, lng: 15.9511 },
];

function getMockCoords(slug: string) {
  const hash = slug.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return MOCK_VENUE_COORDS[hash % MOCK_VENUE_COORDS.length];
}

const GRADIENTS = [
  "linear-gradient(135deg, #1e1b4b 0%, #4338ca 50%, #7c3aed 100%)",
  "linear-gradient(135deg, #0c4a6e 0%, #075985 50%, #0e7490 100%)",
  "linear-gradient(135deg, #064e3b 0%, #047857 50%, #0d9488 100%)",
  "linear-gradient(135deg, #831843 0%, #be185d 50%, #ec4899 100%)",
];

function formatDateLong(isoString: string): string {
  if (!isoString) return "";
  const [datePart, timePart] = isoString.replace("T", " ").split(" ");
  if (!datePart || !timePart) return "";
  const [yr, mo, dy] = datePart.split("-").map(Number);
  const [hr, mn] = timePart.split(":").map(Number);
  if ([yr, mo, dy, hr, mn].some(isNaN)) return "";
  const date = new Date(yr, mo - 1, dy, hr, mn);
  const day = date.toLocaleDateString("hr-HR", { weekday: "long" });
  const dateStr = date.toLocaleDateString("hr-HR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const time = `${String(hr).padStart(2, "0")}:${String(mn).padStart(2, "0")}`;
  return `${day.charAt(0).toUpperCase() + day.slice(1)}, ${dateStr} u ${time}`;
}

export default function EventModalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const [event, setEvent] = useState<EventDiscoveryOut | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("noir_user_loc");
      if (stored) setUserLocation(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetch("/api/v1/noir/events")
      .then((r) => r.json())
      .then((data: EventDiscoveryOut[]) => {
        setEvent(data.find((e) => e.slug === slug) ?? null);
      })
      .catch(console.error);
  }, [slug]);

  const gradient = event
    ? GRADIENTS[event.slug.charCodeAt(0) % GRADIENTS.length]
    : GRADIENTS[0];

  return (
    <>
      <Dialog
        defaultOpen={true}
        onOpenChange={(open) => {
          if (!open) router.back();
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="gap-0 overflow-hidden border-border bg-surface-white p-0 sm:max-w-2xl rounded-[2.5rem]"
        >
          {/* Screen-reader title — visually hidden, required by Radix Dialog for a11y */}
          <DialogTitle className="sr-only">
            {event?.name ?? "Detalji događaja"}
          </DialogTitle>

          {/* Noise texture overlay */}
          <div
            className="pointer-events-none absolute inset-0 z-10 opacity-[0.03] mix-blend-multiply"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            }}
          />

          {event ? (
            <div className="flex flex-col md:flex-row">
              {/* Left: Visual */}
              <div className="relative h-48 w-full overflow-hidden md:h-auto md:w-2/5">
                {event.cover_image_url ? (
                  <Image
                    src={event.cover_image_url}
                    alt={event.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="absolute inset-0" style={{ background: gradient }} />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#2C3840]/60 to-transparent" />

                {/* Age badge */}
                <div className="absolute bottom-6 left-6">
                  <div className="rounded-full border border-white/30 bg-white/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur-md">
                    {event.min_age ? `${event.min_age}+` : "Svi uzrasti"}
                  </div>
                </div>

                {/* Mobile close button */}
                <button
                  onClick={() => router.back()}
                  className="absolute right-4 top-4 rounded-full bg-black/30 p-2 text-white backdrop-blur-sm transition-colors hover:bg-black/50 md:hidden"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Right: Content */}
              <div className="relative flex flex-1 flex-col p-8 md:p-10">
                {/* Desktop close button */}
                <button
                  onClick={() => router.back()}
                  className="absolute right-6 top-6 hidden rounded-full p-2 transition-colors hover:bg-surface md:flex"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>

                <div className="mb-6">
                  <h2 className="font-display mb-2 text-3xl font-bold leading-tight tracking-tight text-neutral">
                    {event.name}
                  </h2>
                  <div className="flex flex-col gap-2">
                    {event.venue_name && (
                      <div className="flex items-center gap-2 font-semibold text-primary">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        <span className="text-sm">
                          {event.venue_name}
                          {userLocation && (() => {
                            const c = getMockCoords(event.slug);
                            const d = haversineDistanceKm(userLocation.lat, userLocation.lng, c.lat, c.lng);
                            return <span className="font-normal text-text-muted">, {formatDistance(d)}</span>;
                          })()}
                        </span>
                      </div>
                    )}
                    {event.occurrence_date && (
                      <div className="flex items-center gap-2 text-text-muted">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        <span className="text-sm font-medium">
                          {formatDateLong(event.occurrence_date)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex-1">
                  <p className="mb-6 text-sm leading-relaxed text-text-muted">
                    {event.description || "Nema opisa za ovaj događaj."}
                  </p>
                  {event.tags && event.tags.length > 0 && (
                    <div className="mb-8 flex flex-wrap gap-2">
                      {event.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-accent/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-auto flex items-center justify-between border-t border-border pt-6">
                  <div>
                    <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-text-muted">
                      Cijena:
                    </p>
                    <p className="font-display text-2xl font-bold text-neutral">
                      {event.is_free || !event.min_price || event.min_price === 0
                        ? "Besplatno"
                        : `${event.min_price}€`}
                    </p>
                  </div>
                  <button
                    onClick={() => setIsCheckoutOpen(true)}
                    className="rounded-2xl bg-primary px-8 py-4 text-xs font-bold uppercase tracking-[0.1em] text-white shadow-lg shadow-primary/10 transition-all hover:bg-neutral hover:shadow-xl hover:shadow-primary/20 active:scale-[0.98]"
                  >
                    Kupi ulaznicu
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Loading state */
            <div className="flex items-center justify-center p-16">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {event && (
        <CheckoutModal
          isOpen={isCheckoutOpen}
          onClose={() => setIsCheckoutOpen(false)}
          event={{
            id: event.id,
            name: event.name,
            price: event.min_price ?? 0,
          }}
        />
      )}
    </>
  );
}
