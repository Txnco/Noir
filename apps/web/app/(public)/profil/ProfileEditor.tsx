"use client";

import { useState, useTransition } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Reveal from "@/components/Reveal";
import { toast } from "@/components/Toaster";
import { updateProfileAction } from "@/lib/auth/profile";
import type { OrgMembershipOut, ProfileOut } from "@/lib/typescript/api-types";

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

type Props = {
  email: string;
  profile: ProfileOut;
  platformRole: string;
  memberships: OrgMembershipOut[];
};

function initialsOf(first: string | null | undefined, last: string | null | undefined, email: string) {
  const f = (first ?? "")[0] ?? "";
  const l = (last ?? "")[0] ?? "";
  return (f + l).toUpperCase() || email[0]?.toUpperCase() || "?";
}

function roleLabel(role: string) {
  switch (role) {
    case "admin":
      return "Administrator";
    case "staff":
      return "Moderator";
    case "user":
    default:
      return "Korisnik";
  }
}

export default function ProfileEditor({ email, profile, platformRole, memberships }: Props) {
  const [firstName, setFirstName] = useState(profile.first_name ?? "");
  const [lastName, setLastName] = useState(profile.last_name ?? "");
  const [city, setCity] = useState(profile.city ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");

  const [pending, startTransition] = useTransition();

  const dirty =
    firstName !== (profile.first_name ?? "") ||
    lastName !== (profile.last_name ?? "") ||
    city !== (profile.city ?? "") ||
    phone !== (profile.phone ?? "");

  function save() {
    if (!firstName.trim()) {
      toast.error("Nedostaje ime", "Unesi svoje ime.");
      return;
    }
    if (!lastName.trim()) {
      toast.error("Nedostaje prezime", "Unesi svoje prezime.");
      return;
    }

    startTransition(async () => {
      const result = await updateProfileAction({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        city: city.trim() || null,
        phone: phone.trim() || null,
      });
      if (result.status === "success") {
        toast.success("Spremljeno", "Profil je ažuriran.");
      } else {
        toast.error("Greška", result.error);
      }
    });
  }

  function reset() {
    setFirstName(profile.first_name ?? "");
    setLastName(profile.last_name ?? "");
    setCity(profile.city ?? "");
    setPhone(profile.phone ?? "");
  }

  const initials = initialsOf(firstName || profile.first_name, lastName || profile.last_name, email);
  const fullName =
    `${firstName || profile.first_name || ""} ${lastName || profile.last_name || ""}`.trim() || email;

  return (
    <div className="noise-bg min-h-screen bg-surface text-neutral">
      <Navbar />

      <main className="relative z-10 mx-auto max-w-4xl px-6 pt-32 pb-20">
        <header className="mb-12 text-center">
          <Reveal variant="fade-up">
            <span className="mb-3 block text-[10px] font-bold tracking-[0.3em] text-accent uppercase">
              Moj profil
            </span>
            <h1 className="font-display text-5xl font-bold tracking-tight text-neutral md:text-6xl">
              Postavke
            </h1>
            <div className="mt-6 flex items-center justify-center gap-4">
              <div className="h-px w-12 bg-border" />
              <p className="text-sm font-medium text-text-muted">
                Uredi osnovne podatke o sebi
              </p>
              <div className="h-px w-12 bg-border" />
            </div>
          </Reveal>
        </header>

        {/* Identity card */}
        <Reveal variant="fade-up">
          <section className="rounded-3xl border border-border bg-surface-white p-6 shadow-sm md:p-8">
            <div className="flex flex-col items-start gap-5 md:flex-row md:items-center">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-white shadow-sm">
                {initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-semibold text-neutral">{fullName}</p>
                <p className="truncate text-sm text-text-muted">{email}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-text-muted">
                    {roleLabel(platformRole)}
                  </span>
                  {memberships.map((m) => (
                    <span
                      key={`${m.org_id}-${m.role}`}
                      className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-medium text-primary"
                    >
                      Org: {m.role}
                    </span>
                  ))}
                  {profile.onboarding_completed && (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                      Onboarding završen
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>
        </Reveal>

        {/* Edit form */}
        <Reveal variant="fade-up" delay={80}>
          <section className="mt-6 rounded-3xl border border-border bg-surface-white p-6 shadow-sm md:p-8">
            <h2 className="font-display text-xl font-extrabold text-neutral">
              Osnovni podaci
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              Email se mijenja u sigurnosnim postavkama Supabase računa.
            </p>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-neutral">
                  Ime
                </label>
                <input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-neutral transition-all focus:border-accent focus:bg-surface-white focus:outline-none focus:ring-4 focus:ring-accent/15"
                />
              </div>

              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-neutral">
                  Prezime
                </label>
                <input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-neutral transition-all focus:border-accent focus:bg-surface-white focus:outline-none focus:ring-4 focus:ring-accent/15"
                />
              </div>

              <div>
                <label htmlFor="city" className="block text-sm font-medium text-neutral">
                  Grad
                </label>
                <input
                  id="city"
                  list="profil-city-options"
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="npr. Zagreb"
                  className="mt-1 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-neutral placeholder:text-text-muted/70 transition-all focus:border-accent focus:bg-surface-white focus:outline-none focus:ring-4 focus:ring-accent/15"
                />
                <datalist id="profil-city-options">
                  {CROATIAN_CITIES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-neutral">
                  Telefon
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+385 ..."
                  className="mt-1 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-neutral placeholder:text-text-muted/70 transition-all focus:border-accent focus:bg-surface-white focus:outline-none focus:ring-4 focus:ring-accent/15"
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="email" className="block text-sm font-medium text-neutral">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  disabled
                  className="mt-1 w-full cursor-not-allowed rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-text-muted"
                />
              </div>
            </div>

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={reset}
                disabled={pending || !dirty}
                className="rounded-full border border-border bg-surface-white px-6 py-3 text-sm font-semibold text-neutral transition-all hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
              >
                Poništi
              </button>
              <button
                type="button"
                onClick={save}
                disabled={pending || !dirty}
                className="flex items-center justify-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition-all hover:bg-neutral hover:shadow-xl hover:shadow-primary/25 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Spremam...
                  </>
                ) : (
                  "Spremi promjene"
                )}
              </button>
            </div>
          </section>
        </Reveal>
      </main>

      <Footer />
    </div>
  );
}
