"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import { toast } from "@/components/Toaster";
import { submitOnboardingAction } from "@/lib/auth/onboarding";
import type { TagOut } from "@/lib/typescript/api-types";

type Step = 1 | 2;

const CROATIAN_CITIES = [
  "Zagreb",
  "Split",
  "Rijeka",
  "Osijek",
  "Zadar",
  "Pula",
  "Slavonski Brod",
  "Karlovac",
  "Varaždin",
  "Šibenik",
  "Dubrovnik",
  "Sisak",
  "Vinkovci",
  "Velika Gorica",
  "Vukovar",
  "Bjelovar",
  "Koprivnica",
  "Samobor",
  "Đakovo",
  "Čakovec",
];

const MONTHS_HR = [
  "Siječanj",
  "Veljača",
  "Ožujak",
  "Travanj",
  "Svibanj",
  "Lipanj",
  "Srpanj",
  "Kolovoz",
  "Rujan",
  "Listopad",
  "Studeni",
  "Prosinac",
];

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = CURRENT_YEAR - 100;
const MAX_YEAR = CURRENT_YEAR - 13; // 13+ to register

function daysInMonth(year: number, month1to12: number) {
  return new Date(year, month1to12, 0).getDate();
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export default function OnboardingWizard({
  firstName,
  genres,
  eventTypes,
}: {
  firstName: string | null;
  genres: TagOut[];
  eventTypes: TagOut[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [pending, startTransition] = useTransition();

  // Step 1 — city + DOB
  const [city, setCity] = useState("");
  const [day, setDay] = useState<number | "">("");
  const [month, setMonth] = useState<number | "">("");
  const [year, setYear] = useState<number | "">("");
  const [step1Error, setStep1Error] = useState<string | null>(null);

  // Step 2 — interests
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = MAX_YEAR; y >= MIN_YEAR; y--) arr.push(y);
    return arr;
  }, []);

  const days = useMemo(() => {
    const dim =
      typeof year === "number" && typeof month === "number"
        ? daysInMonth(year, month)
        : 31;
    return Array.from({ length: dim }, (_, i) => i + 1);
  }, [year, month]);

  function validateStep1(): string | null {
    if (!city.trim()) return "Odaberi ili unesi svoj grad.";
    if (typeof day !== "number" || typeof month !== "number" || typeof year !== "number")
      return "Unesi cijeli datum rođenja.";
    const dob = new Date(year, month - 1, day);
    if (Number.isNaN(dob.getTime())) return "Neispravan datum rođenja.";
    const today = new Date();
    const ageMs = today.getTime() - dob.getTime();
    const ageYears = ageMs / (1000 * 60 * 60 * 24 * 365.25);
    if (ageYears < 13) return "Moraš imati najmanje 13 godina.";
    if (ageYears > 100) return "Provjeri godinu rođenja.";
    return null;
  }

  function goToStep2() {
    const err = validateStep1();
    if (err) {
      setStep1Error(err);
      return;
    }
    setStep1Error(null);
    setStep(2);
  }

  function toggleTag(slug: string) {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function finish(skipTags = false) {
    if (typeof day !== "number" || typeof month !== "number" || typeof year !== "number") return;
    const payload = {
      city: city.trim(),
      date_of_birth: `${year}-${pad(month)}-${pad(day)}`,
      interest_tags: skipTags ? [] : Array.from(selectedTags),
    };

    startTransition(async () => {
      const result = await submitOnboardingAction(payload);
      if (result.status === "success") {
        toast.success("Dobrodošao u Noir!", "Profil je spreman.");
        router.replace("/eventi");
      } else {
        toast.error("Spremanje nije uspjelo", result.error);
      }
    });
  }

  return (
    <div className="noise-bg relative min-h-screen overflow-hidden">
      <div className="absolute top-5 left-6 z-20 md:top-6 md:left-10">
        <Logo href="/" height={28} />
      </div>

      <main className="relative flex min-h-screen items-center py-14 md:py-10">
        <div className="pointer-events-none absolute -top-24 -left-24 h-[420px] w-[420px] rounded-full bg-secondary/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 -bottom-32 h-[320px] w-[320px] rounded-full bg-accent/10 blur-3xl" />

        <div className="relative z-10 mx-auto w-full max-w-2xl px-6">
          {/* Header + progress */}
          <div className="animate-fade-up">
            <p className="text-xs font-semibold tracking-widest text-secondary uppercase">
              Korak {step} / 2
            </p>
            <h1 className="font-display mt-2 text-2xl font-extrabold text-neutral md:text-3xl">
              {step === 1
                ? firstName
                  ? `Bok, ${firstName}! Reci nam ponešto o sebi.`
                  : "Reci nam ponešto o sebi."
                : "Što te zanima?"}
            </h1>
            <p className="mt-1.5 text-sm text-text-muted">
              {step === 1
                ? "Koristimo ove podatke za prikaz evenata u tvojoj blizini i filtriranje dobnih ograničenja."
                : "Odaberi barem 3 stvari koje voliš — tako ti možemo predložiti najbolje evente."}
            </p>

            {/* Progress bar */}
            <div className="mt-5 flex gap-2">
              <div className="h-1 flex-1 rounded-full bg-accent" />
              <div
                className={`h-1 flex-1 rounded-full transition-colors ${
                  step === 2 ? "bg-accent" : "bg-border"
                }`}
              />
            </div>
          </div>

          {/* Card */}
          <div className="animate-fade-up delay-100 mt-6 rounded-2xl border border-border bg-surface-white p-6 shadow-sm md:p-8">
            {step === 1 ? (
              <div className="space-y-5">
                {/* City */}
                <div>
                  <label
                    htmlFor="city"
                    className="block text-sm font-medium text-neutral"
                  >
                    Grad
                  </label>
                  <input
                    id="city"
                    list="city-options"
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="npr. Zagreb"
                    className="mt-1 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-neutral placeholder:text-text-muted/70 transition-all focus:border-accent focus:bg-surface-white focus:outline-none focus:ring-4 focus:ring-accent/15"
                  />
                  <datalist id="city-options">
                    {CROATIAN_CITIES.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>

                {/* DOB */}
                <div>
                  <label className="block text-sm font-medium text-neutral">
                    Datum rođenja
                  </label>
                  <div className="mt-1 grid grid-cols-3 gap-3">
                    <select
                      value={day}
                      onChange={(e) =>
                        setDay(e.target.value ? Number(e.target.value) : "")
                      }
                      className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-neutral transition-all focus:border-accent focus:bg-surface-white focus:outline-none focus:ring-4 focus:ring-accent/15"
                    >
                      <option value="">Dan</option>
                      {days.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                    <select
                      value={month}
                      onChange={(e) =>
                        setMonth(e.target.value ? Number(e.target.value) : "")
                      }
                      className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-neutral transition-all focus:border-accent focus:bg-surface-white focus:outline-none focus:ring-4 focus:ring-accent/15"
                    >
                      <option value="">Mjesec</option>
                      {MONTHS_HR.map((m, i) => (
                        <option key={m} value={i + 1}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <select
                      value={year}
                      onChange={(e) =>
                        setYear(e.target.value ? Number(e.target.value) : "")
                      }
                      className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-neutral transition-all focus:border-accent focus:bg-surface-white focus:outline-none focus:ring-4 focus:ring-accent/15"
                    >
                      <option value="">Godina</option>
                      {years.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {step1Error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {step1Error}
                  </div>
                )}

                <button
                  type="button"
                  onClick={goToStep2}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition-all hover:bg-neutral hover:shadow-xl hover:shadow-primary/25 active:scale-[0.97]"
                >
                  Dalje
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M3 8h10M9 4l4 4-4 4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Genres */}
                <div>
                  <h3 className="text-sm font-semibold text-neutral">
                    Glazbeni žanrovi
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {genres.map((tag) => (
                      <TagChip
                        key={tag.id}
                        label={tag.name}
                        selected={selectedTags.has(tag.slug)}
                        onClick={() => toggleTag(tag.slug)}
                      />
                    ))}
                  </div>
                </div>

                {/* Event types */}
                <div>
                  <h3 className="text-sm font-semibold text-neutral">
                    Tipovi evenata
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {eventTypes.map((tag) => (
                      <TagChip
                        key={tag.id}
                        label={tag.name}
                        selected={selectedTags.has(tag.slug)}
                        onClick={() => toggleTag(tag.slug)}
                      />
                    ))}
                  </div>
                </div>

                {selectedTags.size > 0 && selectedTags.size < 3 && (
                  <p className="text-xs text-text-muted">
                    Odabrano: {selectedTags.size}. Preporučamo barem 3.
                  </p>
                )}

                <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-between sm:gap-4">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    disabled={pending}
                    className="rounded-full border border-border bg-surface-white px-6 py-3 text-sm font-semibold text-neutral transition-all hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    ← Natrag
                  </button>

                  <div className="flex flex-col-reverse gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => finish(false)}
                      disabled={pending}
                      className="flex items-center justify-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition-all hover:bg-neutral hover:shadow-xl hover:shadow-primary/25 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {pending ? (
                        <>
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          Spremam...
                        </>
                      ) : (
                        "Završi"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function TagChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition-all active:scale-95 ${
        selected
          ? "border-accent bg-accent/15 text-primary shadow-sm"
          : "border-border bg-surface text-neutral hover:border-accent/60 hover:bg-accent/5"
      }`}
    >
      {label}
    </button>
  );
}
