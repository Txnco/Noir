"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CheckoutModal from "@/components/CheckoutModal";
import type { EventDiscoveryOut } from "@/lib/typescript/api-types";
import { haversineDistanceKm, formatDistance, slugHash } from "@/lib/utils";

const GRADIENTS = [
  "linear-gradient(135deg, #1e1b4b 0%, #4338ca 50%, #7c3aed 100%)",
  "linear-gradient(135deg, #0c4a6e 0%, #075985 50%, #0e7490 100%)",
  "linear-gradient(135deg, #064e3b 0%, #047857 50%, #0d9488 100%)",
  "linear-gradient(135deg, #831843 0%, #be185d 50%, #ec4899 100%)",
];

const MOCK_VENUE_COORDS = [
  { lat: 45.8128, lng: 15.9641 },
  { lat: 45.7886, lng: 15.9268 },
  { lat: 45.8162, lng: 15.9726 },
  { lat: 45.8008, lng: 15.9697 },
  { lat: 45.8189, lng: 15.9748 },
  { lat: 45.8225, lng: 15.9511 },
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

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const [event, setEvent] = useState<EventDiscoveryOut | null | undefined>(undefined);
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
        const found = data.find((e) => e.slug === slug);
        setEvent(found ?? null);
      })
      .catch(() => setEvent(null));
  }, [slug]);

  // undefined = loading, null = not found
  if (event === null) notFound();

  const gradient =
    event ? GRADIENTS[slugHash(event.slug, GRADIENTS.length)] : GRADIENTS[0];

  return (
    <div className="noise-bg relative min-h-screen">
      <Navbar cta={{ label: "Svi eventi", href: "/eventi" }} />

      <div className="mx-auto max-w-4xl px-6 pb-24 pt-36">
        <Link
          href="/eventi"
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-text-muted transition-colors hover:text-primary"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Nazad na evente
        </Link>

        {event === undefined ? (
          /* Loading skeleton */
          <div className="overflow-hidden rounded-3xl border border-border bg-surface-white shadow-xl">
            <div className="h-72 animate-pulse bg-surface sm:h-96" />
            <div className="p-8 sm:p-12">
              <div className="mb-4 h-8 w-3/4 animate-pulse rounded-xl bg-surface" />
              <div className="mb-2 h-4 w-1/2 animate-pulse rounded-lg bg-surface" />
              <div className="h-4 w-1/3 animate-pulse rounded-lg bg-surface" />
            </div>
          </div>
        ) : (
          <article className="overflow-hidden rounded-3xl border border-border bg-surface-white shadow-xl">
            {/* Cover image */}
            <div className="relative h-72 bg-[#2C3840] sm:h-96">
              {event.cover_image_url ? (
                <Image
                  src={event.cover_image_url}
                  alt={event.name}
                  fill
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="absolute inset-0" style={{ background: gradient }} />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#2C3840]/80 to-transparent" />

              {/* Age badge */}
              <div className="absolute bottom-6 left-6">
                <div className="rounded-full border border-white/30 bg-white/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur-md">
                  {event.min_age ? `${event.min_age}+` : "Svi uzrasti"}
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-8 sm:p-12">
              <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
                <div className="flex-1">
                  <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-neutral sm:text-4xl">
                    {event.name}
                  </h1>

                  <div className="mt-4 flex flex-col gap-2">
                    {event.venue_name && (
                      <div className="flex items-center gap-2 text-primary">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        <span className="font-semibold">
                          {event.venue_name}
                          {userLocation && (
                            <span className="font-normal text-text-muted">
                              {", "}
                              {formatDistance(haversineDistanceKm(
                                userLocation.lat, userLocation.lng,
                                MOCK_VENUE_COORDS[slugHash(event.slug, MOCK_VENUE_COORDS.length)].lat,
                                MOCK_VENUE_COORDS[slugHash(event.slug, MOCK_VENUE_COORDS.length)].lng,
                              ))}
                            </span>
                          )}
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
                        <span className="font-medium">
                          {formatDateLong(event.occurrence_date)}
                        </span>
                      </div>
                    )}
                  </div>

                  {event.description && (
                    <p className="mt-6 text-base leading-relaxed text-text-muted">
                      {event.description}
                    </p>
                  )}

                  {event.tags && event.tags.length > 0 && (
                    <div className="mt-6 flex flex-wrap gap-2">
                      {event.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-accent/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Purchase card */}
                <div className="w-full shrink-0 rounded-2xl border border-border bg-surface p-6 md:w-72">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
                    Cijena:
                  </p>
                  <p className="font-display mt-1 text-3xl font-bold text-neutral">
                    {event.is_free || !event.min_price || event.min_price === 0
                      ? "Besplatno"
                      : `${event.min_price}€`}
                  </p>
                  <button
                    onClick={() => setIsCheckoutOpen(true)}
                    className="mt-6 w-full rounded-2xl bg-primary py-4 text-xs font-bold uppercase tracking-[0.1em] text-white shadow-lg shadow-primary/20 transition-all hover:bg-neutral hover:shadow-xl active:scale-[0.98]"
                  >
                    {event.is_free || !event.min_price || event.min_price === 0
                      ? "Rezerviraj besplatno"
                      : "Kupi ulaznicu"}
                  </button>
                </div>
              </div>
            </div>
          </article>
        )}
      </div>

      <Footer />

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
    </div>
  );
}
